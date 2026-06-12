// Supabase API Integration & Core Frontend Logic

// 1. CONSTANTS
const CATEGORIES = [
    { id: 'Toor', name: 'Toor Dal', desc: 'Pigeon pea, amber yellow' },
    { id: 'Moong', name: 'Moong Dal', desc: 'Green gram, mild & sweet' },
    { id: 'Urad', name: 'Urad Dal', desc: 'Black gram, rich & creamy' },
    { id: 'Chana', name: 'Chana Dal', desc: 'Split chickpeas, nutty flavor' },
    { id: 'Masoor', name: 'Masoor Dal', desc: 'Red lentils, earthy & quick' }
];

const DEFAULT_BAG_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="%23F3EFE9"/><path d="M30 30 C 30 10, 70 10, 70 30 L 75 80 C 75 85, 25 85, 25 80 Z" fill="%23D9A05B" stroke="%23B47329" stroke-width="3"/><path d="M30 30 L 70 30" stroke="%23B47329" stroke-width="4"/><path d="M40 25 L 60 25" stroke="%23FAF8F5" stroke-width="2"/><circle cx="50" cy="55" r="12" fill="%23FAF8F5" opacity="0.3"/><text x="50" y="59" font-family="sans-serif" font-weight="bold" font-size="10" fill="%23784714" text-anchor="middle">DAL</text></svg>`;

// Supabase Global Config variables (hydrated from Vercel/Express environment)
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

// 2. STATE OBJECT
const state = {
    currentPage: 'home', // 'home' | 'category'
    activeCategory: null,
    searchQuery: '',
    editingRecordId: null,
    selectedPhotoBlob: null,   // Holds the compressed binary image file during upload
    existingPhotoUrl: '',      // Holds existing image URL in edit mode
    people: []
};

// 3. DOM ELEMENTS CACHE
const elements = {
    backBtn: document.getElementById('back-btn'),
    appTitle: document.getElementById('app-title'),
    
    // Views
    homeView: document.getElementById('home-view'),
    categoryView: document.getElementById('category-view'),
    
    // Dashboard & Home Lists
    statTotalRecords: document.getElementById('stat-total-records'),
    statLastUpdated: document.getElementById('stat-last-updated'),
    categoryList: document.getElementById('category-list'),
    
    // Category detail components
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    peopleList: document.getElementById('people-list'),
    fabAdd: document.getElementById('fab-add'),
    
    // Modals
    modalOverlay: document.getElementById('modal-overlay'),
    formModal: document.getElementById('form-modal'),
    formModalTitle: document.getElementById('form-modal-title'),
    recordForm: document.getElementById('record-form'),
    editRecordId: document.getElementById('edit-record-id'),
    formName: document.getElementById('form-name'),
    formPhone: document.getElementById('form-phone'),
    formCameraFile: document.getElementById('form-camera-file'),
    formGalleryFile: document.getElementById('form-gallery-file'),
    actionSheetOverlay: document.getElementById('action-sheet-overlay'),
    photoActionSheet: document.getElementById('photo-action-sheet'),
    btnSourceCamera: document.getElementById('btn-source-camera'),
    btnSourceGallery: document.getElementById('btn-source-gallery'),
    btnSourceCancel: document.getElementById('btn-source-cancel'),
    uploadBox: document.getElementById('upload-box'),
    previewWrapper: document.getElementById('preview-wrapper'),
    imagePreview: document.getElementById('image-preview'),
    removePreviewBtn: document.getElementById('remove-preview-btn'),
    btnCancel: document.getElementById('btn-cancel'),
    closeModal: document.getElementById('close-modal'),
    
    // Zoom Modal
    zoomModal: document.getElementById('zoom-modal'),
    zoomImg: document.getElementById('zoom-img'),
    closeZoom: document.getElementById('close-zoom'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container'),
    
    // Loading Overlay
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// 4. LOADING OVERLAY HELPERS
function showLoading(text) {
    if (text) {
        elements.loadingText.textContent = text;
    }
    elements.loadingOverlay.classList.add('active');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('active');
}

// 5. SUPABASE NETWORK FETCH WRAPPER WITH VERBOSE DEBUG LOGGING
async function supabaseFetch(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("[supabaseFetch Error] Credentials not initialized!");
        throw new Error("Supabase credentials not loaded. Verify your backend .env settings.");
    }
    
    const url = `${SUPABASE_URL.replace(/\/$/, '')}${path}`;
    
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        ...options.headers
    };
    
    console.log(`[Supabase Request Debug]`);
    console.log(`- Method: ${options.method || 'GET'}`);
    console.log(`- Request URL: ${url}`);
    console.log(`- Headers:`, { apikey: SUPABASE_KEY ? "EXISTS" : "MISSING", Authorization: headers.Authorization ? "EXISTS" : "MISSING" });
    if (options.body) {
        console.log(`- Payload:`, JSON.parse(options.body));
    }
    
    let response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch (networkErr) {
        console.error(`[Supabase Request Failed] Network error or CORS issue:`, networkErr);
        throw networkErr;
    }
    
    console.log(`- Response HTTP Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
        const errBody = await response.text();
        console.error(`- Response Error Body:`, errBody);
        throw new Error(`Database Error (${response.status}): ${errBody}`);
    }
    
    if (response.status === 204) {
        console.log(`- Response Body: [204 No Content]`);
        return null;
    }
    
    const responseJson = await response.json();
    console.log(`- Response JSON Payload:`, responseJson);
    return responseJson;
}

// 6. DATABASE ACTIONS (SUPABASE GET, ADD, EDIT, DELETE)
async function loadPeopleData() {
    showLoading("Loading records from Supabase...");
    try {
        const data = await supabaseFetch('/people?order=created_at.desc');
        
        // Map snake_case database columns to camelCase state objects
        state.people = data.map(row => ({
            id: row.id,
            name: row.name,
            phone: row.phone_number,
            category: row.dal_category,
            photo: row.photo_url,
            createdDate: row.created_at
        }));
        console.log("Loaded People", state.people);
    } catch (err) {
        console.error("Fetch failed:", err);
        showToast("Database Sync Error: " + err.message);
    } finally {
        hideLoading();
    }
}

// 7. VIEW ROUTER (NAVIGATION)
function navigateTo(page, categoryId = null) {
    state.currentPage = page;
    state.activeCategory = categoryId;
    
    elements.homeView.classList.remove('active');
    elements.categoryView.classList.remove('active');
    
    if (page === 'home') {
        elements.backBtn.style.display = 'none';
        elements.appTitle.textContent = "Dal Manager";
        elements.homeView.classList.add('active');
        renderDashboard();
    } else if (page === 'category') {
        elements.backBtn.style.display = 'flex';
        elements.appTitle.textContent = `${categoryId} Dal`;
        elements.categoryView.classList.add('active');
        
        // Reset search field
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearch.style.display = 'none';
        
        renderCategoryList();
    }
}

// 8. DASHBOARD RENDERER
function renderDashboard() {
    console.log("Rendering Categories", state.people);
    elements.statTotalRecords.textContent = state.people.length;
    
    if (state.people.length > 0) {
        const sorted = [...state.people].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
        const latestDate = new Date(sorted[0].createdDate);
        elements.statLastUpdated.textContent = formatTimeAgo(latestDate);
    } else {
        elements.statLastUpdated.textContent = "No Activity";
    }
    
    elements.categoryList.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const count = state.people.filter(p => p.category === cat.id).length;
        
        const card = document.createElement('div');
        card.className = 'category-card';
        card.setAttribute('data-category', cat.id);
        
        const avatarLetter = cat.id.charAt(0);
        const avatarClass = cat.id.toLowerCase();
        
        card.innerHTML = `
            <div class="card-info">
                <div class="category-avatar ${avatarClass}">${avatarLetter}</div>
                <div>
                    <div class="category-name">${cat.id}</div>
                    <div class="category-desc">${cat.desc}</div>
                </div>
            </div>
            <div class="card-arrow">
                <span class="record-badge">${count} ${count === 1 ? 'person' : 'people'}</span>
                <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        `;
        
        card.addEventListener('click', () => {
            navigateTo('category', cat.id);
        });
        
        elements.categoryList.appendChild(card);
    });
    console.log("[renderDashboard] Successfully rendered main category grid.");
}

// 9. CATEGORY LIST RENDERER (PEOPLE LIST)
function renderCategoryList() {
    elements.peopleList.innerHTML = '';
    
    let filteredList = state.people.filter(p => p.category === state.activeCategory);
    
    if (state.searchQuery.trim() !== '') {
        const query = state.searchQuery.toLowerCase().trim();
        filteredList = filteredList.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.phone.includes(query)
        );
    }
    
    if (filteredList.length === 0) {
        renderEmptyState();
        return;
    }
    
    filteredList.forEach(person => {
        const card = document.createElement('div');
        card.className = 'person-card';
        card.setAttribute('data-id', person.id);
        
        const displayPhoto = person.photo || DEFAULT_BAG_SVG;
        const formattedDate = formatFullDate(new Date(person.createdDate));
        
        card.innerHTML = `
            <div class="bag-photo-wrapper" title="Tap to zoom">
                <img class="bag-photo" src="${displayPhoto}" alt="${person.name}'s bag" onerror="this.src='${DEFAULT_BAG_SVG}'">
            </div>
            <div class="person-details">
                <div>
                    <h4 class="person-name">${person.name}</h4>
                    <a href="tel:${person.phone}" class="person-phone" title="Call ${person.name}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        ${person.phone}
                    </a>
                    <div class="person-date" title="Created date">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>${formattedDate}</span>
                    </div>
                </div>
                <div class="person-actions">
                    <button class="action-btn edit">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                    </button>
                    <button class="action-btn delete">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        // Setup direct click listeners to prevent string injection/escaping issues in onclick tags
        const editBtn = card.querySelector('.action-btn.edit');
        const deleteBtn = card.querySelector('.action-btn.delete');
        const photoWrapper = card.querySelector('.bag-photo-wrapper');
        
        editBtn.addEventListener('click', () => openEditForm(person.id));
        deleteBtn.addEventListener('click', () => deleteRecord(person.id));
        photoWrapper.addEventListener('click', () => {
            const displayPhoto = person.photo || DEFAULT_BAG_SVG;
            zoomImage(displayPhoto);
        });
        
        elements.peopleList.appendChild(card);
    });
    
    console.log(`[renderCategoryList] Successfully rendered ${filteredList.length} record cards for category: ${state.activeCategory}`);
}

function renderEmptyState() {
    const isSearch = state.searchQuery.trim() !== '';
    const icon = isSearch ? `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
    ` : `
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    `;
    
    const title = isSearch ? "No Search Matches" : "Category is Empty";
    const desc = isSearch ? "Try checking spelling or type a different query." : `Tap the "+" button below to add the first person to ${state.activeCategory} category.`;
    
    elements.peopleList.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h4 class="empty-state-title">${title}</h4>
            <p class="empty-state-desc">${desc}</p>
        </div>
    `;
}

// 10. FORM MODAL CONTROLLERS
function openAddForm() {
    state.editingRecordId = null;
    elements.formModalTitle.textContent = "Add Record";
    elements.editRecordId.value = '';
    elements.formName.value = '';
    elements.formPhone.value = '';
    
    resetPhotoPreview();
    openModal();
}

window.openEditForm = function(recordId) {
    const record = state.people.find(p => p.id === recordId);
    if (!record) return;
    
    state.editingRecordId = recordId;
    elements.formModalTitle.textContent = "Edit Record";
    elements.editRecordId.value = recordId;
    elements.formName.value = record.name;
    elements.formPhone.value = record.phone;
    
    // Clear newly selected photo blob
    state.selectedPhotoBlob = null;
    
    // Show current photo
    if (record.photo) {
        state.existingPhotoUrl = record.photo;
        elements.imagePreview.src = record.photo;
        elements.uploadBox.style.display = 'none';
        elements.previewWrapper.style.display = 'block';
    } else {
        resetPhotoPreview();
    }
    
    openModal();
};

function openModal() {
    elements.modalOverlay.classList.add('active');
    elements.formModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modalOverlay.classList.remove('active');
    elements.formModal.classList.remove('active');
    document.body.style.overflow = '';
}

function resetPhotoPreview() {
    state.selectedPhotoBlob = null;
    state.existingPhotoUrl = '';
    elements.formCameraFile.value = '';
    elements.formGalleryFile.value = '';
    elements.imagePreview.src = '';
    elements.uploadBox.style.display = 'flex';
    elements.previewWrapper.style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const name = elements.formName.value.trim();
    const phone = elements.formPhone.value.trim();
    const recordId = elements.editRecordId.value;
    
    console.log("[handleFormSubmit Triggered]");
    console.log(`- Form values - Name: "${name}", Phone: "${phone}", editRecordId: "${recordId}"`);
    console.log(`- Active Category: "${state.activeCategory}"`);
    
    if (!name || !phone) {
        console.error("[handleFormSubmit Validation Error] Required fields missing.");
        showToast("Please fill all required fields.");
        return;
    }
    
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
        console.error("[handleFormSubmit Validation Error] Phone number too short.");
        showToast("Please enter a valid phone number.");
        return;
    }
    
    showLoading("Saving to Supabase Cloud...");
    
    try {
        let photoUrl = '';
        
        // 1. If a new photo blob is selected, upload it to Supabase Storage
        if (state.selectedPhotoBlob) {
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
            const rootDomain = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
            const uploadUrl = `${rootDomain}/storage/v1/object/Dal%20Photos/${fileName}`;
            
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'image/jpeg'
                },
                body: state.selectedPhotoBlob
            });
            
            if (!uploadResponse.ok) {
                const errText = await uploadResponse.text();
                throw new Error(`Storage Upload Failed: ${uploadResponse.status} - ${errText}`);
            }
            
            // Construct the public URL for the storage bucket
            photoUrl = `${rootDomain}/storage/v1/object/public/Dal%20Photos/${fileName}`;
        } else if (recordId) {
            // Edit mode: Keep existing photo
            photoUrl = state.existingPhotoUrl;
        } else {
            // New entry: Default to static bag asset
            photoUrl = "assets/default_bag.png";
        }
        
        // 2. Map frontend payload fields to Supabase database columns
        const dbPayload = {
            name: name,
            phone_number: phone,
            dal_category: state.activeCategory,
            photo_url: photoUrl
        };
        
        if (recordId) {
            // Edit Mode: Update database row
            await supabaseFetch(`/people?id=eq.${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(dbPayload)
            });
            showToast("Entry updated successfully!");
        } else {
            // Add Mode: Insert new database row
            await supabaseFetch('/people', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(dbPayload)
            });
            showToast("Entry added successfully!");
        }
        
        closeModal();
        await loadPeopleData(); // Sync updated records
        renderCategoryList();
    } catch (err) {
        console.error("Save transaction failed:", err);
        showToast("Save Failed: " + err.message);
    } finally {
        hideLoading();
    }
}

window.deleteRecord = async function(recordId) {
    const record = state.people.find(p => p.id === recordId);
    if (!record) return;
    
    if (confirm(`Are you sure you want to delete ${record.name}'s record from Supabase?`)) {
        showLoading(`Deleting ${record.name}...`);
        try {
            await supabaseFetch(`/people?id=eq.${recordId}`, {
                method: 'DELETE'
            });
            
            state.people = state.people.filter(p => p.id !== recordId);
            showToast("Record deleted successfully.");
            renderCategoryList();
        } catch (err) {
            console.error("Deletion failed:", err);
            showToast("Delete Failed: " + err.message);
        } finally {
            hideLoading();
        }
    }
};

// 12. IMAGE UPLOAD & CANVAS COMPRESSION
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast("Please select an image file.");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Resize using Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Output Canvas contents as binary JPEG Blob for direct file upload
            canvas.toBlob(function(blob) {
                state.selectedPhotoBlob = blob;
                elements.imagePreview.src = URL.createObjectURL(blob);
                
                elements.uploadBox.style.display = 'none';
                elements.previewWrapper.style.display = 'block';
            }, 'image/jpeg', 0.75);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 13. IMAGE ZOOM MODAL CONTROLS
window.zoomImage = function(src) {
    elements.zoomImg.src = src;
    elements.zoomModal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeZoomModal() {
    elements.zoomModal.classList.remove('active');
    if (!elements.formModal.classList.contains('active')) {
        document.body.style.overflow = '';
    }
}

// 14. TOAST NOTIFICATION SYSTEM
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span>${message}</span>
        <span style="font-size:10px; margin-left:12px; opacity:0.6;">Dismiss</span>
    `;
    
    toast.addEventListener('click', () => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 200);
    });
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 200);
        }
    }, 3000);
}

// 15. DATE AND TIME FORMATTERS
function formatFullDate(date) {
    const options = { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('en-US', options);
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    
    if (interval >= 1) return interval + "y ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + "mo ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + "d ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + "m ago";
    return seconds < 10 ? "Just now" : Math.floor(seconds) + "s ago";
}

// 16. EVENT LISTENERS SETUP
function setupEventListeners() {
    elements.backBtn.addEventListener('click', () => {
        navigateTo('home');
    });
    
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery.trim() !== '') {
            elements.clearSearch.style.display = 'flex';
        } else {
            elements.clearSearch.style.display = 'none';
        }
        renderCategoryList();
    });
    
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearch.style.display = 'none';
        elements.searchInput.focus();
        renderCategoryList();
    });
    
    elements.fabAdd.addEventListener('click', openAddForm);
    elements.closeModal.addEventListener('click', closeModal);
    elements.btnCancel.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', closeModal);
    elements.recordForm.addEventListener('submit', handleFormSubmit);
    
    // Image selection source options sheet triggers
    elements.uploadBox.addEventListener('click', () => {
        elements.actionSheetOverlay.classList.add('active');
        elements.photoActionSheet.classList.add('active');
    });

    const closeActionSheet = () => {
        elements.actionSheetOverlay.classList.remove('active');
        elements.photoActionSheet.classList.remove('active');
    };

    elements.actionSheetOverlay.addEventListener('click', closeActionSheet);
    elements.btnSourceCancel.addEventListener('click', closeActionSheet);

    elements.btnSourceCamera.addEventListener('click', () => {
        closeActionSheet();
        elements.formCameraFile.click();
    });

    elements.btnSourceGallery.addEventListener('click', () => {
        closeActionSheet();
        elements.formGalleryFile.click();
    });

    // File change listeners
    elements.formCameraFile.addEventListener('change', handleImageSelect);
    elements.formGalleryFile.addEventListener('change', handleImageSelect);
    elements.removePreviewBtn.addEventListener('click', resetPhotoPreview);
    
    elements.closeZoom.addEventListener('click', closeZoomModal);
    elements.zoomModal.addEventListener('click', (e) => {
        if (e.target === elements.zoomModal || e.target === elements.closeZoom) {
            closeZoomModal();
        }
    });
    
    elements.uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadBox.classList.add('drag-over');
    });
    
    elements.uploadBox.addEventListener('dragleave', () => {
        elements.uploadBox.classList.remove('drag-over');
    });
    
    elements.uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadBox.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            elements.formGalleryFile.files = e.dataTransfer.files;
            const event = new Event('change');
            elements.formGalleryFile.dispatchEvent(event);
        }
    });
}

// 17. INITIALIZE APPLICATION (FETCH CONFIG & SYNC DATABASE)
async function init() {
    showLoading("Connecting to database config...");
    try {
        // Fetch config credentials from backend
        const configResponse = await fetch('/api/config');
        if (!configResponse.ok) {
            throw new Error(`Failed to load config endpoint: ${configResponse.status}`);
        }
        
        const config = await configResponse.json();
        SUPABASE_URL = config.supabaseUrl;
        SUPABASE_KEY = config.supabaseKey;
        
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            throw new Error("Supabase credentials missing in database configuration.");
        }
        
        // Fetch rows from Supabase
        await loadPeopleData();
        setupEventListeners();
        navigateTo('home');
    } catch (err) {
        console.error("Startup initialization failure:", err);
        showToast("Database Connection Error: " + err.message);
        
        // Setup empty layout so the app is partially responsive/resilient
        setupEventListeners();
        navigateTo('home');
    } finally {
        hideLoading();
    }
}

document.addEventListener('DOMContentLoaded', init);
