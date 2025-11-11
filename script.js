// --- STATE ---
let selectedItemId = null;
let scanBuffer = '';
let scanTimer = null;

// --- DOM ELEMENTS (GLOBAL) ---
let itemDisplayArea;
let selectionDisplay;
let messageArea;
let scanPrompt;

/**
 * 1. Fetches item data from the API and renders the cards.
 */
async function renderItems() {
    let items = [];
    try {
        const response = await fetch('api/items');
        if (!response.ok) {
            throw new Error(`Failed to fetch items: ${response.statusText}`);
        }
        items = await response.json();
    } catch (error) {
        console.error("Error fetching items:", error);
        showMessage("Could not load items from server. Please refresh.", "error");
        return; // Don't try to render
    }

    // Clear the old items
    itemDisplayArea.innerHTML = '';

    // If no items, show a message
    if (!items || items.length === 0) {
        itemDisplayArea.innerHTML = '<p class="text-gray-500 col-span-full text-center">No loaner items found in the database.</p>';
        return;
    }

    items.forEach(item => {
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
 * 2. Processes the scanned ID by calling the API.
 * This is the CORE logic of our app.
 */
async function processScan(scannedId) {
    if (!scannedId) {
        showMessage("Scan failed. Please try again.", "error");
        return;
    }

    scanPrompt.textContent = `Processing ID: ${scannedId}...`;
    scanPrompt.classList.add('text-blue-600'); // Show processing state

    try {
        const response = await fetch('api/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                scannedId: scannedId,
                selectedItemId: selectedItemId // Will be null if no item is selected (for returns)
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // API returned an error (4xx, 5xx)
            // We expect the API to send a JSON with an 'error' or 'message' field
            const message = result.error || result.message || "An unknown error occurred.";
            showMessage(message, "error");
        } else {
            // API returned a success (2xx)
            // We expect a 'message' field
            showMessage(result.message, "success");
        }

    } catch (error) {
        console.error("Error during scan processing:", error);
        showMessage("Could not connect to the server. Check network.", "error");
    }

    // --- CLEANUP ---
    clearSelection();
    await renderItems(); // Re-draw the UI with the new data from the server
    
    // Reset the prompt after a moment
    setTimeout(() => {
        scanPrompt.textContent = "Waiting for ID card scan...";
        scanPrompt.classList.remove('text-blue-600');
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
    }, 5000); // Show messages for 5 seconds
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
    clearTimeout(scanTimer);

    if (event.key === 'Enter') {
        event.preventDefault(); 
        if (scanBuffer.length > 0) {
            processScan(scanBuffer); // Process the scanned ID
        }
        scanBuffer = ''; // Clear the buffer
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        scanBuffer += event.key;
    }
    
    scanTimer = setTimeout(() => {
        scanBuffer = '';
    }, 100); // 100ms timeout to differentiate scan vs. human
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

    // Draw the initial state *from the API*
    renderItems(); 
    
    // Listen for clicks on the background to clear selection
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('.item-card')) {
            clearSelection();
        }
    });

    // Start listening for the "scanner"
    document.addEventListener('keydown', handleGlobalKeyDown);
}

// Start the app once the HTML document is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

