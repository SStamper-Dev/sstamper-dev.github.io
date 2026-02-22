const API_BASE = "https://crudbackend-production-6bb6.up.railway.app";
let allOrders = []; // Full list from DB
let filteredOrders = []; // After sorting/filtering
let currentPage = 1;

// 1. Set a cookie (The Authority to save state)
function setCookie(name, value) {
    // max-age is in seconds (31536000 = 1 year)
    document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

// 2. Get a cookie (The Authority to read state)
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// 2. Image Logic (Requirement #3)
function getPizzaImage(size, crust) {
    const s = size.toLowerCase();
    const c = crust.toLowerCase().replace(" ", "");
    return `images/${s}_${c}.jpg`; // e.g., large_regular.jpg
}

// 2. Hydrate Toppings (Requirement #5)
async function populateToppings() {
    const toppings = ["Pepperoni", "Sausage", "Bacon", "Extra Cheese", "Mushrooms", "Green Peppers", "Olives", "Pineapple"];
    const selects = document.querySelectorAll('.topping-select');
    
    selects.forEach(select => {
        select.innerHTML = '<option value="">None</option>' + 
            toppings.map(t => `<option value="${t}">${t}</option>`).join('');
    });

    // Populate the Filter dropdown too
    const filterDropdown = document.getElementById('filterTopping');
    filterDropdown.innerHTML = '<option value="">All Toppings</option>' + 
        toppings.map(t => `<option value="${t}">${t}</option>`).join('');
}

function goToPage(page) {
    const pageSize = parseInt(getCookie('pageSize')) || 10;
    const totalPages = Math.ceil(filteredOrders.length / pageSize);

    // 1. Boundary Check: Prevent going out of bounds
    if (page < 1 || page > totalPages) return;

    // 2. Update Global State
    currentPage = page;

    // 3. Re-render the Grid (The View)
    renderGrid(filteredOrders, pageSize);

    // 4. CRITICAL: Re-render the Pagination Buttons to update the 'Disabled' logic
    renderPagination(filteredOrders.length);
}

function renderPagination(totalItems) {
    const pageSize = parseInt(getCookie('pageSize')) || 10;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const nav = document.getElementById('pagination');
    
    // 5. Fresh Logic Check: Re-calculate 'disabled' every single time this is called
    const isPrevDisabled = currentPage === 1 ? 'disabled' : '';
    const isNextDisabled = currentPage === totalPages ? 'disabled' : '';

    nav.innerHTML = `
        <button class="btn-nav ${isPrevDisabled}" onclick="goToPage(${currentPage - 1})" ${isPrevDisabled}>&laquo;</button>
        <span class="page-indicator"><strong>${currentPage}</strong> of ${totalPages}</span>
        <button class="btn-nav ${isNextDisabled}" onclick="goToPage(${currentPage + 1})" ${isNextDisabled}>&raquo;</button>
    `;
}

async function confirmDelete(id) {
    // 1. User Confirmation (The "Safety Catch")
    if (confirm(`Are you sure you want to delete this order?`)) {
        try {
            // 2. Send the request to your Railway Backend
            const res = await fetch(`${API_BASE}/delete-pizza/${id}`, { 
                method: 'DELETE' 
            });

            if (res.ok) {
                alert("Order deleted successfully!");
                // 3. Refresh the list to reflect the new state of the database
                loadPizzas(); 
            } else {
                alert("Failed to delete the order.");
            }
        } catch (err) {
            console.error("Delete operation failed:", err);
        }
    }
}

function renderGrid(data, pageSize) {
    const grid = document.getElementById('orderGrid');
    const start = (currentPage - 1) * pageSize;
    const end = start + parseInt(pageSize);
    const paginatedData = data.slice(start, end);

    grid.innerHTML = paginatedData.map(p => `
        <div class="order-card">
            <img src="${getPizzaImage(p.size, p.crust)}" alt="Pizza" class="pizza-img">
            
            <h4>${p.size} ${p.crust}</h4> 
            
            <div class="order-details">
                <em>${p.order_type}</em><br>
                <strong>Toppings:</strong> ${p.topping_names || 'Plain'}
            </div>
            
            <div style="display:flex; gap:10px;">
                <button onclick="editOrder(${p.id})" class="btn-edit">Edit</button>
                <button onclick="confirmDelete(${p.id})" class="btn-delete">Delete</button>
            </div>
        </div>
    `).join('');
}

// 4. The Stats Logic (The "View" stats)
function updateStats(data) {
    document.getElementById('statTotal').innerText = data.length;
    
    const toppingCounts = {};
    data.forEach(p => {
        if (p.topping_names) {
            p.topping_names.split(',').forEach(t => {
                toppingCounts[t] = (toppingCounts[t] || 0) + 1;
            });
        }
    });
    
    const topTopping = Object.keys(toppingCounts).reduce((a, b) => 
        toppingCounts[a] > toppingCounts[b] ? a : b, "-");
    document.getElementById('statTopTopping').innerText = topTopping;
}

// 5. Main Load Update
async function loadPizzas() {
    const res = await fetch(`${API_BASE}/pizzas`);
    allOrders = await res.json();
    
    const filterT = document.getElementById('filterTopping').value;
    const sortBy = document.getElementById('sortSelect').value;
    
    // Apply Filtering
    filteredOrders = filterT ? 
        allOrders.filter(p => p.topping_names && p.topping_names.includes(filterT)) : 
        [...allOrders];

    // Apply Sorting (Requirement #4)
    const sizeMap = { "Small": 1, "Medium": 2, "Large": 3 };
    filteredOrders.sort((a, b) => {
        if (sortBy === 'size_asc') return sizeMap[a.size] - sizeMap[b.size];
        if (sortBy === 'size_desc') return sizeMap[b.size] - sizeMap[a.size];
        if (sortBy === 'id_asc') return a.id - b.id;
        return b.id - a.id;
    });

    const pageSize = parseInt(getCookie('pageSize')) || 10;

    updateStats(allOrders); 
    renderGrid(filteredOrders, pageSize);
    renderPagination(filteredOrders.length);
}

// Add these inside your DOMContentLoaded listener in script.js
document.getElementById('orderForm').addEventListener('submit', placeOrder);
document.getElementById('editForm').addEventListener('submit', updateOrder);

async function placeOrder(e) {
    e.preventDefault(); // Stop the browser from looking for api.php
    
    const formData = new FormData(e.target);
    
    // Architect Note: We map the 3 topping selects into a single array for the backend
    const toppings = [formData.get('t1'), formData.get('t2'), formData.get('t3')]
                     .filter(t => t && t !== "");

    const orderData = {
        size: formData.get('size'),
        crust: formData.get('crust'),
        order_type: formData.get('type'),
        toppings: toppings
    };

    try {
        const res = await fetch(`${API_BASE}/add-pizza`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (res.ok) {
            alert("Order placed successfully!");
            e.target.reset(); // Clear the form
            loadPizzas(); // Refresh the grid to show the new pizza
        }
    } catch (err) {
        console.error("Submission failed:", err);
    }
}

// 1. Open the Modal & Populate with Current Data
function editOrder(id) {
    const order = allOrders.find(p => p.id === id);
    if (!order) return;

    // Fill the hidden ID field so the backend knows which record to update
    document.getElementById('editId').value = id;
    document.getElementById('editSize').value = order.size;
    document.getElementById('editCrust').value = order.crust;
    document.getElementById('editType').value = order.order_type;

    // Handle Toppings (Clean Slate approach)
    const toppings = order.topping_names ? order.topping_names.split(',') : [];
    document.getElementById('editT1').value = toppings[0] || "";
    document.getElementById('editT2').value = toppings[1] || "";
    document.getElementById('editT3').value = toppings[2] || "";

    document.getElementById('editModal').style.display = 'block';
}

// 2. The missing updateOrder function (The "PUT" Authority)
async function updateOrder(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const formData = new FormData(e.target);
    
    const toppings = [formData.get('t1'), formData.get('t2'), formData.get('t3')]
                     .filter(t => t && t !== "");

    const updateData = {
        size: formData.get('size'),
        crust: formData.get('crust'),
        order_type: formData.get('type'),
        toppings: toppings
    };

    try {
        const res = await fetch(`${API_BASE}/update-pizza/${id}`, {
            method: 'PUT', // The HTTP verb for updates
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (res.ok) {
            alert("Order updated!");
            closeModal();
            loadPizzas(); // Refresh the grid to see the changes
        }
    } catch (err) {
        console.error("Update failed:", err);
    }
}

// Helper to shut the window
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

function changePageSize(val) {
    // 1. Reset the "Bookmark" to the first page
    currentPage = 1; 
    
    // 2. Persist the choice in the user's browser
    setCookie('pageSize', val);
    
    // 3. Trigger a full refresh of the View
    loadPizzas(); 
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    populateToppings();
    const savedSize = getCookie('pageSize');
    if (savedSize) document.getElementById('pageSizeSelect').value = savedSize;
    loadPizzas();
});