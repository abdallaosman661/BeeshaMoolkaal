// ============================================================
// 0. API config
// ============================================================
// Use 127.0.0.1 (not "localhost") to avoid stale-HSTS issues in some browsers.
const API_BASE = 'http://127.0.0.1:5000/api/media';

// ============================================================
// 1. API Helper (replaces the old IndexedDB layer)
// ============================================================

// Uploads a media item. Either a file (image or video) or a YouTube link for video.
async function addMediaItem({ title, desc, url, file, type }) {
    if (type === 'video' && url) {
        // YouTube link — no file upload needed, just save the metadata.
        const res = await fetch(`${API_BASE}/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description: desc, videoUrl: url })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error (${res.status})`);
        }
        return res.json();
    }

    // Image or video file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', desc || '');

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server error (${res.status})`);
    }
    return res.json();
}

// Fetches all media and normalizes field names to what renderItems() expects.
async function getAllMedia() {
    const res = await fetch(API_BASE);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server error (${res.status})`);
    }
    const items = await res.json();
    return items.map(i => ({
        id: i.id,
        title: i.title,
        desc: i.description,
        url: i.fileUrl,
        type: i.fileType
    }));
}

async function deleteMediaItem(id) {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Server error (${res.status})`);
    }
}

// ============================================================
// 2. UI Elements
// ============================================================
const typeImageBtn = document.getElementById('typeImageBtn');
const typeVideoBtn = document.getElementById('typeVideoBtn');
const mediaType = document.getElementById('mediaType');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('desc');
const imageUpload = document.getElementById('imageUpload');
const videoUrl = document.getElementById('videoUrl');
const videoUpload = document.getElementById('videoUpload');
const submitBtn = document.getElementById('submitUploadBtn');
const grid = document.getElementById('portfolioGrid');
const statsInfo = document.getElementById('statsInfo');
const messageBox = document.getElementById('messageBox');
const uploadSection = document.getElementById('upload');
const unlockAdminBtn = document.getElementById('unlockAdminBtn');

const passwordModal = document.getElementById('passwordModal');
const adminPasswordInput = document.getElementById('adminPassword');
const confirmPasswordBtn = document.getElementById('confirmPasswordBtn');
const closePasswordModalBtn = document.getElementById('closePasswordModalBtn');
const passwordError = document.getElementById('passwordError');

let selectedType = 'image';
let isAdminUnlocked = false;
const ADMIN_PASSWORD = 'admin123';

// ============================================================
// 3. Render
// ============================================================
function renderItems(items) {
    grid.innerHTML = '';
    if (!items || items.length === 0) {
        grid.innerHTML =
            `<div class="empty-portfolio"><i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:1rem;"></i>Weli ma jiraan wax kaydsan.</div>`;
        statsInfo.innerHTML = `<i class="fas fa-database"></i> Wadar: 0`;
        return;
    }
    statsInfo.innerHTML = `<i class="fas fa-database"></i> Wadar: ${items.length}`;
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'portfolio-item';
        div.style.animationDelay = `${(index % 6) * 0.1 + 0.1}s`;

        // Media
        if (item.type === 'image') {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.title || 'Sawir';
            img.loading = 'lazy';
            div.appendChild(img);
        } else {
            const videoWrapper = document.createElement('div');
            videoWrapper.className = 'portfolio-video';
            if (item.url && item.url.includes('youtube')) {
                const iframe = document.createElement('iframe');
                const videoId = item.url.split('v=')[1]?.split('&')[0];
                iframe.src = `https://www.youtube.com/embed/${videoId}`;
                iframe.allowFullscreen = true;
                iframe.style.width = '100%';
                iframe.style.height = '210px';
                iframe.style.border = 'none';
                videoWrapper.appendChild(iframe);
            } else {
                const video = document.createElement('video');
                video.src = item.url;
                video.controls = true;
                video.preload = 'metadata';
                video.style.width = '100%';
                video.style.height = '210px';
                video.style.objectFit = 'cover';
                videoWrapper.appendChild(video);
            }
            div.appendChild(videoWrapper);
        }

        // Info
        const info = document.createElement('div');
        info.className = 'portfolio-info';
        const badge = document.createElement('span');
        badge.className = `media-badge ${item.type === 'image' ? 'badge-image' : 'badge-video'}`;
        badge.textContent = item.type === 'image' ? '🖼️ Sawir' : '🎬 Video';
        info.appendChild(badge);

        const titleP = document.createElement('p');
        titleP.textContent = item.title || 'Aan la cayimin';
        info.appendChild(titleP);

        if (item.desc) {
            const descP = document.createElement('p');
            descP.textContent = item.desc;
            info.appendChild(descP);
        }

        // Delete button
        if (isAdminUnlocked) {
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.title = 'Tirtir';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Ma hubtaa inaad tirtirto "${item.title || 'tan'}"?`)) {
                    try {
                        await deleteMediaItem(item.id);
                        await loadAndRender();
                        showMessage('✅ Waa la tirtiray!', 'success');
                    } catch (err) {
                        console.error(err);
                        showMessage('❌ Khalad tirtiridda: ' + err.message, 'error');
                    }
                }
            });
            div.appendChild(delBtn);
        }

        div.appendChild(info);
        grid.appendChild(div);
    });
}

function showMessage(msg, type = 'info') {
    messageBox.textContent = msg;
    messageBox.style.color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#64748b');
    setTimeout(() => { messageBox.textContent = ''; }, 5000);
}

// ============================================================
// 4. Load & Render
// ============================================================
async function loadAndRender() {
    try {
        statsInfo.innerHTML = `<i class="fas fa-database"></i> Soo gelinta...`;
        const items = await getAllMedia();
        renderItems(items);
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="empty-portfolio">❌ Ma soo gelin xogta. Hubi in backend-ka (ASP.NET) uu socdo.</div>`;
        statsInfo.innerHTML = `<i class="fas fa-database"></i> Khalad`;
    }
}

// ============================================================
// 5. Submit Upload
// ============================================================
submitBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    let file = null;
    let url = '';

    if (!title) {
        showMessage('❌ Fadlan geli cinwaan.', 'error');
        return;
    }

    if (selectedType === 'image') {
        file = imageUpload.files[0];
        if (!file) {
            showMessage('❌ Fadlan xulo sawir.', 'error');
            return;
        }
    } else {
        const urlVal = videoUrl.value.trim();
        const videoFile = videoUpload.files[0];
        if (urlVal) {
            url = urlVal;
        } else if (videoFile) {
            file = videoFile;
        } else {
            showMessage('❌ Fadlan geli YouTube link ama xulo fayl video.', 'error');
            return;
        }
    }

    submitBtn.disabled = true;
    showMessage('⏳ Waa la soo gelinayaa...', 'info');

    try {
        await addMediaItem({ title, desc, url, file, type: selectedType });
        titleInput.value = '';
        descInput.value = '';
        imageUpload.value = '';
        videoUrl.value = '';
        videoUpload.value = '';
        await loadAndRender();
        showMessage('✅ Waa la kaydiyay!', 'success');
    } catch (err) {
        console.error(err);
        showMessage('❌ Khalad kaydinta: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
    }
});

// ============================================================
// 6. Type Selector
// ============================================================
typeImageBtn.addEventListener('click', () => {
    typeImageBtn.classList.add('active');
    typeVideoBtn.classList.remove('active');
    selectedType = 'image';
    mediaType.value = 'image';
    document.getElementById('imageField').style.display = 'block';
    document.getElementById('videoField').style.display = 'none';
});

typeVideoBtn.addEventListener('click', () => {
    typeVideoBtn.classList.add('active');
    typeImageBtn.classList.remove('active');
    selectedType = 'video';
    mediaType.value = 'video';
    document.getElementById('imageField').style.display = 'none';
    document.getElementById('videoField').style.display = 'block';
});

// ============================================================
// 7. Admin Panel
// ============================================================
unlockAdminBtn.addEventListener('click', () => {
    if (isAdminUnlocked) {
        return;
    }
    passwordModal.style.display = 'flex';
    adminPasswordInput.value = '';
    passwordError.textContent = '';
    adminPasswordInput.focus();
});

closePasswordModalBtn.addEventListener('click', () => {
    passwordModal.style.display = 'none';
});

passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
        passwordModal.style.display = 'none';
    }
});

confirmPasswordBtn.addEventListener('click', async () => {
    const entered = adminPasswordInput.value.trim();
    if (entered === ADMIN_PASSWORD) {
        passwordModal.style.display = 'none';
        isAdminUnlocked = true;
        uploadSection.style.display = 'block';
        unlockAdminBtn.innerHTML = '<i class="fas fa-lock"></i> Xir Qaybta Admin (Guji Laba Jeer)';
        unlockAdminBtn.style.background = '#dc2626';
        await loadAndRender();
        showMessage('✅ Admin waa la furay!', 'success');
        uploadSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        passwordError.textContent = '❌ Password khalad ah.';
        adminPasswordInput.value = '';
        adminPasswordInput.focus();
    }
});

// Double-click to close admin
unlockAdminBtn.addEventListener('dblclick', () => {
    if (isAdminUnlocked) {
        isAdminUnlocked = false;
        uploadSection.style.display = 'none';
        unlockAdminBtn.innerHTML = '<i class="fas fa-key"></i> Fur Qaybta Admin (Upload & Delete)';
        unlockAdminBtn.style.background = '#1e293b';
        loadAndRender();
        showMessage('🔒 Admin waa la xidhay.', 'info');
    }
});

// ============================================================
// 8. Header Scroll Effect
// ============================================================
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ============================================================
// 9. Smooth scroll for nav links
// ============================================================
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// ============================================================
// 10. Init
// ============================================================
(async function init() {
    await loadAndRender();
})();

console.log('🐝 Beesha Moolkaal website waa diyaar! (Backend: ASP.NET + MongoDB + UploadThing)');
console.log('🔑 Admin Password: admin123');
