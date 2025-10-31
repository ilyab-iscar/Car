import sqlite3
import subprocess
import json
from flask import Flask, jsonify, request, g
from datetime import datetime

# --- CONFIGURATION ---
DATABASE = 'checkout.db'
app = Flask(__name__)

# --- DATABASE HELPER FUNCTIONS ---

def get_db():
    """Opens a new database connection if one is not already open."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        # Use Row objects to access columns by name
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    """Closes the database connection at the end of the request."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    """Helper function to run a query."""
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def execute_db(query, args=()):
    """Helper function to execute a command (INSERT, UPDATE, DELETE)."""
    db = get_db()
    cur = db.cursor()
    cur.execute(query, args)
    db.commit()
    cur.close()

# --- ACTIVE DIRECTORY HELPER FUNCTION ---

def get_ad_user_name(user_id):
    """
    Looks up a user's name in Active Directory using PowerShell.
    This is the "secret sauce" that connects to your on-prem DC.
    """
    if not user_id:
        return None, "No User ID provided"

    # We use 'employeeID' as the filter. You might need to change this
    # to 'sAMAccountName' or whatever field your barcode scanner's ID matches.
    ps_command = (
        f"Get-ADUser -Filter 'EmployeeID -eq \"{user_id}\"' | "
        "Select-Object Name | ConvertTo-Json"
    )
    
    # We run the command using powershell.exe
    try:
        result = subprocess.run(
            ["powershell.exe", "-Command", ps_command],
            capture_output=True,
            text=True,
            timeout=5, # 5 second timeout
            check=True # Throw an error if PowerShell fails
        )
        
        output = result.stdout.strip()
        
        if not output:
            print(f"AD Lookup: No user found with ID {user_id}")
            return None, f"No user found with ID {user_id}"
            
        # The output might be a single object or an array
        user_data = json.loads(output)
        
        # Handle if Get-ADUser returns a list (should be rare for ID)
        if isinstance(user_data, list):
            if not user_data:
                return None, f"No user found with ID {user_id}"
            user_name = user_data[0].get('Name')
        else:
            user_name = user_data.get('Name')

        if not user_name:
            print(f"AD Lookup: User {user_id} found but has no 'Name' property.")
            return None, "User found but name is missing"

        print(f"AD Lookup: Found user {user_id} -> {user_name}")
        return user_name, None # Success!

    except subprocess.CalledProcessError as e:
        print(f"PowerShell error: {e.stderr}")
        return None, "PowerShell command failed"
    except subprocess.TimeoutExpired:
        print("AD lookup timed out")
        return None, "Active Directory lookup timed out"
    except Exception as e:
        print(f"An unexpected error occurred during AD lookup: {e}")
        return None, "An unknown error occurred during user lookup"

# --- LOGGING FUNCTION ---

def log_action(item, user_id, user_name, action):
    """Writes an entry to the checkout_log table."""
    try:
        execute_db(
            """
            INSERT INTO checkout_log (timestamp, item_id, item_name, action, user_id, user_name)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(),
                item['id'],
                item['name'],
                action,     # "Checked Out" or "Returned"
                user_id,
                user_name
            )
        )
    except Exception as e:
        # We print the error but don't stop the main transaction
        # It's more important that the checkout/return succeeds
        print(f"!!! FAILED TO WRITE TO LOG: {e} !!!")


# --- API ENDPOINTS ---

@app.route('/api/items', methods=['GET'])
def get_items():
    """
    Endpoint to get the current status of all items.
    Called by the frontend on page load.
    """
    try:
        items = query_db("SELECT * FROM items")
        # Convert list of Row objects to list of dicts
        return jsonify([dict(item) for item in items])
    except Exception as e:
        print(f"Error in /api/items: {e}")
        return jsonify({"error": "Failed to retrieve items from database"}), 500

@app.route('/api/scan', methods=['POST'])
def process_scan():
    """
    Main endpoint to process a checkout or return.
    This is the core logic of the entire application.
    """
    data = request.json
    scanned_id = data.get('scannedId')
    selected_item_id = data.get('selectedItemId') # Can be null

    if not scanned_id:
        return jsonify({"error": "No ID was scanned."}), 400

    # 1. Look up the user in Active Directory
    user_name, error = get_ad_user_name(scanned_id)
    if error:
        return jsonify({"error": f"Invalid User ID. ({error})"}), 404 # 404 Not Found

    # 2. Check if this is a RETURN
    # Does this user already have an item checked out?
    item_to_return = query_db("SELECT * FROM items WHERE checkedOutBy = ?", [scanned_id], one=True)
    
    if item_to_return:
        try:
            # YES, this is a RETURN
            execute_db(
                "UPDATE items SET status = 'Available', checkedOutBy = NULL, checkedOutByName = NULL WHERE id = ?",
                [item_to_return['id']]
            )
            # Log this action
            log_action(item_to_return, scanned_id, user_name, "Returned")
            
            return jsonify({
                "message": f"Thank you, {user_name}. Item \"{item_to_return['name']}\" has been returned.",
                "type": "success"
            })
        except Exception as e:
            print(f"Error during RETURN: {e}")
            return jsonify({"error": "Database error while returning item."}), 500

    # 3. If not a return, it must be a CHECKOUT
    if not selected_item_id:
        return jsonify({
            "error": "Please select an available item *before* scanning your ID to check out.",
            "type": "error"
        }), 400 # 400 Bad Request

    # Get the item they're trying to check out
    item_to_checkout = query_db("SELECT * FROM items WHERE id = ?", [selected_item_id], one=True)

    if not item_to_checkout:
        return jsonify({"error": "Selected item does not exist."}), 404
    
    if item_to_checkout['status'] != 'Available':
        return jsonify({
            "error": f"Item \"{item_to_checkout['name']}\" is already checked out by {item_to_checkout['checkedOutByName']}.",
            "type": "error"
        }), 409 # 409 Conflict

    # 4. Process the CHECKOUT
    try:
        execute_db(
            "UPDATE items SET status = 'Checked Out', checkedOutBy = ?, checkedOutByName = ? WHERE id = ?",
            [scanned_id, user_name, selected_item_id]
        )
        # Log this action
        log_action(item_to_checkout, scanned_id, user_name, "Checked Out")
        
        return jsonify({
            "message": f"Thank you, {user_name}. You have checked out \"{item_to_checkout['name']}\".",
            "type": "success"
        })
    except Exception as e:
        print(f"Error during CHECKOUT: {e}")
        return jsonify({"error": "Database error while checking out item."}), 500


# --- RUN FOR TESTING ---
# This allows us to run the app directly with `python app.py`
# for testing, before we deploy it to IIS.
if __name__ == '__main__':
    #app.run(debug=True, port=5000)
    port = int(os.environ.get('HTTP_PLATFORM_PORT', 5000))  # Use IIS port if available, fallback to 5000 for local testing
    app.run(host='0.0.0.0', port=port, threaded=True)  # '0.0.0.0' allows external access; threaded for basic concurrency