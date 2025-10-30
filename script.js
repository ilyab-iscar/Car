// --- MOCK DATA ---
let mockItemDB = [
    { id: "laptop1", name: "Loaner Laptop 1", status: "Available", checkedOutBy: null, checkedOutByName: null },
    { id: "laptop2", name: "Loaner Laptop 2", status: "Checked Out", checkedOutBy: "987654321", checkedOutByName: "Jane Doe" },
    { id: "projector1", name: "Portable Projector", status: "Available", checkedOutBy: null, checkedOutByName: null }
];

// --- STATE ---
let selectedItemId = null;
let scanBuffer = '';
let scanTimer = null;

// --- DOM ELEMENTS (GLOBAL) ---
// We need these available to all functions
let itemDisplayArea;
let selectionDisplay;
let messageArea;
let scanPrompt;

/**
 * 1. Renders the item cards on the page.
 */
function renderItems() {
    // Clear the old items
    itemDisplayArea.innerHTML = '';

    mockItemDB.forEach(item => {
        const isAvailable = item.status === 'Available';

        const card = document.createElement('div');
        card.className = `item-card p-6 rounded-lg border-2 shadow-md transition-all ${
            isAvailable 
            ? 'bg-white cursor-pointer hover:shadow-lg' 
            : 'bg-gray-100 border-gray-200 opacity-70'
        }`;
        card.dataset.itemId = item.id;

        const statusColor = isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const statusBadge = `<span class="px-3 py-1 rounded-full text-sm font-medium ${statusColor}">${item.status}</span>`;
        const itemName = `<h3 class="text-2xl font-bold text-gray-900 mt-3">${item.name}</h3>`;
        const userInfo = isAvailable
            ? '<p class="text-gray-500 h-6">&nbsp;</p>'
            : `<p class="text-gray-600 h-6 mt-2">By: ${item.checkedOutByName || item.checkedOutBy}</p>`;
        
        card.innerHTML = statusBadge + itemName + userInfo;

        if (isAvailable) {
            card.addEventListener('click', () => {
                selectedItemId = item.id;
                selectionDisplay.innerHTML = `<span class="font-semibold text-blue-600">Selected: ${item.name}</span>`;
                document.querySelectorAll('.item-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        }
        itemDisplayArea.appendChild(card);
    });
}

/**
 * 2. Processes the scanned ID.
 * This is the CORE logic of our app.
 */
function processScan(scannedId) {
    if (!scannedId) {
        showMessage("Scan failed. Please try again.", "error");
        return;
    }

    scanPrompt.textContent = `Scanned ID: ${scannedId}`;

    // MOCK API CALL: Look up user name
    const mockUserName = `User (${scannedId.slice(-4)})`;
    
    // --- LOGIC ---
    const itemToReturn = mockItemDB.find(item => item.checkedOutBy === scannedId);
    
    if (itemToReturn) {
        // YES, this is a RETURN
        itemToReturn.status = "Available";
        itemToReturn.checkedOutBy = null;
        itemToReturn.checkedOutByName = null;
        
        showMessage(`Thank you, ${mockUserName}. Item "${itemToReturn.name}" has been returned.`, "success");

    } else if (selectedItemId) {
        // NO, this is a CHECKOUT
        const itemToCheckout = mockItemDB.find(item => item.id === selectedItemId);

        if (itemToCheckout && itemToCheckout.status === 'Available') {
            itemToCheckout.status = "Checked Out";
            itemToCheckout.checkedOutBy = scannedId;
            itemToCheckout.checkedOutByName = mockUserName;

            showMessage(`Thank you, ${mockUserName}. You have checked out "${itemToCheckout.name}".`, "success");
        } else {
            showMessage("That item is no longer available. Please select another.", "error");
        }

    } else {
        // NOT a return, and NO item is selected
        showMessage("Please select an available item *before* scanning your ID to check out.", "error");
    }

    // --- CLEANUP ---
    clearSelection();
    renderItems(); // Re-draw the UI
    
    // Reset the prompt after a moment
    setTimeout(() => {
        scanPrompt.textContent = "Waiting for ID card scan...";
    }, 2000);
}

/**
 * 3. Shows a success or error message.
 */
function showMessage(message, type = 'success') {
    const color = type === 'success' ? 'text-green-600' : 'text-red-600';
    messageArea.innerHTML = `<span class="${color}">${message}</span>`;

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

/**
 * 5. Handles all key presses for the "in-memory" scanner.
 */
function handleGlobalKeyDown(event) {
    // Reset the timer on *every* keypress
    clearTimeout(scanTimer);

    if (event.key === 'Enter') {
        event.preventDefault(); // Stop 'Enter' from doing anything else
        if (scanBuffer.length > 0) {
            processScan(scanBuffer);
        }
        scanBuffer = ''; // Clear the buffer
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        // It's a printable character (a-z, 0-9, symbols)
        scanBuffer += event.key;
    }
    
    // Set a timer. If nothing else is "typed" for 100ms,
    // we assume it was a slow human, not a fast scan, so we clear the buffer.
    scanTimer = setTimeout(() => {
        scanBuffer = '';
    }, 100);
}

/**
 * 6. Initializes the application.
 */
function initializeApp() {
    // Find all our elements
    itemDisplayArea = document.getElementById('item-display-area');
    selectionDisplay = document.getElementById('selection-display');
    messageArea = document.getElementById('message-area');
    scanPrompt = document.getElementById('scan-prompt');

    // Draw the initial state
    renderItems(); 
    
    // Listen for clicks on the background to clear selection
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('.item-card')) {
            clearSelection();
        }
    });

    // --- THIS IS THE NEW, IMPORTANT PART ---
    // Start listening for the "scanner"
    document.addEventListener('keydown', handleGlobalKeyDown);
}

// Start the app once the HTML document is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

