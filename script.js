// --- MOCK DATA ---
// In the real app, this will come from our Python API.
// We will "mock" the database state.
let mockItemDB = [
    { id: "laptop1", name: "Loaner Laptop 1", status: "Available", checkedOutBy: null, checkedOutByName: null },
    { id: "laptop2", name: "Loaner Laptop 2", status: "Checked Out", checkedOutBy: "987654321", checkedOutByName: "Jane Doe" },
    { id: "projector1", name: "Portable Projector", status: "Available", checkedOutBy: null, checkedOutByName: null }
];

// --- STATE ---
let selectedItemId = null;

// --- DOM ELEMENTS ---
// We wrap this in a function to ensure it runs *after* the DOM is loaded.
function initializeApp() {
    const itemDisplayArea = document.getElementById('item-display-area');
    const selectionDisplay = document.getElementById('selection-display');
    const scanForm = document.getElementById('scan-form');
    const barcodeInput = document.getElementById('barcode-input');
    const messageArea = document.getElementById('message-area');

    // --- FUNCTIONS ---

    /**
     * 1. Renders the item cards on the page.
     * This function reads the 'mockItemDB' and builds the HTML.
     */
    function renderItems() {
        // Clear the old items
        itemDisplayArea.innerHTML = '';

        mockItemDB.forEach(item => {
            const isAvailable = item.status === 'Available';

            // Create the card div
            const card = document.createElement('div');
            card.className = `item-card p-6 rounded-lg border-2 shadow-md transition-all ${
                isAvailable 
                ? 'bg-white cursor-pointer hover:shadow-lg' 
                : 'bg-gray-100 border-gray-200 opacity-70'
            }`;
            card.dataset.itemId = item.id; // Store item id on the element

            // Status badge
            const statusColor = isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const statusBadge = `<span class="px-3 py-1 rounded-full text-sm font-medium ${statusColor}">${item.status}</span>`;

            // Item Name
            const itemName = `<h3 class="text-2xl font-bold text-gray-900 mt-3">${item.name}</h3>`;

            // User Info
            const userInfo = isAvailable
                ? '<p class="text-gray-500 h-6">&nbsp;</p>' // Placeholder for alignment
                : `<p class="text-gray-600 h-6 mt-2">By: ${item.checkedOutByName || item.checkedOutBy}</p>`;
            
            card.innerHTML = statusBadge + itemName + userInfo;

            // Add click listener ONLY if available
            if (isAvailable) {
                card.addEventListener('click', () => {
                    // Set the selected item
                    selectedItemId = item.id;
                    
                    // Update selection text
                    selectionDisplay.innerHTML = `<span class="font-semibold text-blue-600">Selected: ${item.name}</span>`;

                    // Update card visual styles
                    document.querySelectorAll('.item-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');

                    // Focus the input
                    barcodeInput.focus();
                });
            }
            itemDisplayArea.appendChild(card);
        });
    }

    /**
     * 2. Handles the barcode "scan" (form submission).
     * This is the CORE logic of our app.
     */
    function handleScan(event) {
        event.preventDefault(); // Stop the page from reloading
        
        const scannedId = barcodeInput.value.trim();
        if (!scannedId) {
            showMessage("Please scan a valid ID.", "error");
            return;
        }

        // MOCK API CALL: Look up user name
        // In the real app, we'd call our Python/PowerShell API here.
        // For now, we'll invent a name.
        const mockUserName = `User (${scannedId.slice(-4)})`;
        
        // --- LOGIC ---
        // Is this a RETURN?
        const itemToReturn = mockItemDB.find(item => item.checkedOutBy === scannedId);
        
        if (itemToReturn) {
            // YES, this is a RETURN
            itemToReturn.status = "Available";
            itemToReturn.checkedOutBy = null;
            itemToReturn.checkedOutByName = null;
            
            showMessage(`Thank you, ${mockUserName}. Item "${itemToReturn.name}" has been returned.`, "success");

        } else if (selectedItemId) {
            // NO, this is a CHECKOUT (and an item is selected)
            const itemToCheckout = mockItemDB.find(item => item.id === selectedItemId);

            if (itemToCheckout && itemToCheckout.status === 'Available') {
                // Item is available! Check it out.
                itemToCheckout.status = "Checked Out";
                itemToCheckout.checkedOutBy = scannedId;
                itemToCheckout.checkedOutByName = mockUserName; // Use our mock name

                showMessage(`Thank you, ${mockUserName}. You have checked out "${itemToCheckout.name}".`, "success");
            } else {
                // Item was already checked out by someone else
                showMessage("That item is no longer available. Please select another.", "error");
            }

        } else {
            // NOT a return, and NO item is selected
            showMessage("Please select an available item *before* scanning your ID to check out.", "error");
        }

        // --- CLEANUP ---
        clearSelection();
        renderItems(); // Re-draw the UI with the new data
        barcodeInput.value = ''; // Clear the input
        barcodeInput.focus(); // Re-focus after a scan
    }

    /**
     * 3. Shows a success or error message for a few seconds.
     */
    function showMessage(message, type = 'success') {
        const color = type === 'success' ? 'text-green-600' : 'text-red-600';
        messageArea.innerHTML = `<span class="${color}">${message}</span>`;

        // Clear the message after 5 seconds
        setTimeout(() => {
            if (messageArea.innerHTML.includes(message)) {
                messageArea.innerHTML = '';
            }
        }, 5000);
    }

    /**
     * 4. Clears the current item selection.
     */
    function clearSelection() {
        selectedItemId = null;
        selectionDisplay.innerHTML = '';
        document.querySelectorAll('.item-card').forEach(c => c.classList.remove('selected'));
    }

    // --- INITIALIZE ---
    // Run this when the page loads
    
    renderItems(); // Draw the items
    scanForm.addEventListener('submit', handleScan);
    
    // Always keep the barcode scanner input focused
    barcodeInput.focus();
    document.body.addEventListener('click', (e) => {
        // If the user clicks anywhere *except* an item card, refocus the input
        if (!e.target.closest('.item-card')) {
            barcodeInput.focus();
        }
    });
}

// The 'defer' attribute in the <script> tag (in index.html) ensures
// this script runs *after* the HTML is parsed.
// However, using 'DOMContentLoaded' is the most robust way
// to ensure all elements are ready.
document.addEventListener('DOMContentLoaded', initializeApp);
