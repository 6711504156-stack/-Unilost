import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// นำเข้าระบบ Auth สำหรับระบุตัวตนผู้ใช้ฮับ 🛡️
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ================= Firebase Configuration =================
const firebaseConfig = {
    apiKey: "AIzaSyD0Iso45TFPSP3_fqXgfG_DVn3y3qWfgGA",
    authDomain: "unilost-3ccc0.firebaseapp.com",
    projectId: "unilost-3ccc0",
    storageBucket: "unilost-3ccc0.firebasestorage.app",
    messagingSenderId: "680649043114",
    appId: "1:680649043114:web:b05bcd0e1f51cedd2af4d3",
    measurementId: "G-XCTZW6HXZ6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // เตรียมใช้งานระบบยืนยันตัวตน

let currentUserId = null; // ตัวแปรเก็บรหัสประจำตัวของคนที่เข้าเว็บ

// ================= DOM Elements =================
const views = { home: document.getElementById('home-view'), form: document.getElementById('form-view') };
const buttons = {
    reportLost: document.getElementById('btn-report-lost'),
    reportFound: document.getElementById('btn-report-found'),
    back: document.getElementById('btn-back'),
    cancel: document.getElementById('btn-cancel'),
    logo: document.getElementById('nav-logo')
};
const form = document.getElementById('report-form');
const submitBtn = document.getElementById('btn-submit');
const imageInput = document.getElementById('imageUpload');
const imagePreview = document.getElementById('image-preview');
const imagePreviewContainer = document.getElementById('image-preview-container');
const uploadIconWrapper = document.getElementById('upload-icon-wrapper');
const base64Output = document.getElementById('base64ImageOutput');
const reportsGrid = document.getElementById('reports-grid');
const emptyState = document.getElementById('empty-state');
const listLoader = document.getElementById('list-loader');

// ================= Utilities =================
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-pink-500' : (type === 'error' ? 'bg-red-400' : 'bg-blue-400');
    const icon = type === 'success' ? 'fa-heart' : (type === 'error' ? 'fa-face-sad-tear' : 'fa-paw');

    toast.className = `toast flex items-center ${bgClass} text-white px-6 py-4 rounded-2xl shadow-xl mb-3 border border-white/30`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-xl mr-3 animate-bounce"></i> <div><p class="font-medium tracking-wide">${message}</p></div>`;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function navigateTo(viewName, defaultType = null) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Object.values(views).forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('opacity-100');
    });
    const target = views[viewName];
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('opacity-100'), 50);

    if (viewName === 'form') {
        form.reset();
        resetImagePreview();
        if (defaultType) {
            document.querySelector(`input[name="reportType"][value="${defaultType}"]`).checked = true;
        }
    }
}

function resetImagePreview() {
    base64Output.value = '';
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    uploadIconWrapper.classList.remove('hidden');
}

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = height * (MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function timeAgo(date) {
    if (!date) return 'เมื่อกี้เลยฮับ 🐾';
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " ปีที่แล้ว";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " เดือนที่แล้ว";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " วันที่แล้ว";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ชั่วโมงที่แล้ว";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " นาทีที่แล้ว";
    return "เมื่อกี้เลยฮับ 🐾";
}

// ================= Event Listeners =================
buttons.reportLost.addEventListener('click', () => navigateTo('form', 'lost'));
buttons.reportFound.addEventListener('click', () => navigateTo('form', 'found'));
buttons.back.addEventListener('click', () => navigateTo('home'));
buttons.cancel.addEventListener('click', () => navigateTo('home'));
buttons.logo.addEventListener('click', () => navigateTo('home'));

imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('อ๊ะ! ใส่ได้แค่รูปภาพนะฮับ 🥺', 'error');
        return;
    }

    try {
        uploadIconWrapper.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        imagePreview.src = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/spinner.svg';
        imagePreview.classList.add('animate-spin', 'p-10');
        
        const compressedBase64 = await compressImage(file);
        imagePreview.classList.remove('animate-spin', 'p-10');
        imagePreview.src = compressedBase64;
        base64Output.value = compressedBase64;
    } catch (error) {
        console.error('Image error:', error);
        showToast('งื้ออ ประมวลผลรูปไม่ได้ฮับ 😭', 'error');
        resetImagePreview();
    }
});

// ================= ฟังก์ชัน อัปเดตสถานะ =================
reportsGrid.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (!deleteBtn) return;

    const docId = deleteBtn.getAttribute('data-id');
    
    if (confirm('🎉 เจอของหรือคืนของเรียบร้อยแล้วใช่ไหมฮับ?\n(ข้อมูลจะถูกเปลี่ยนสถานะเป็น "สำเร็จ" และบันทึกเป็นสถิติให้แอปเราต่อไปฮับ)')) {
        try {
            const docRef = doc(db, 'reports', docId);
            
            await updateDoc(docRef, {
                status: 'resolved'
            });
            
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#D4AF37', '#4A148C', '#00e676', '#87ceeb'] 
            });

            showToast('เย้! เก่งมากฮับ เปลี่ยนสถานะสำเร็จแล้ว 💖', 'success');
        } catch (error) {
            console.error("Error updating document: ", error);
            showToast('แงง เปลี่ยนสถานะไม่ได้ เกิดข้อผิดพลาดฮับ 🥺', 'error');
        }
    }
});

// ================= บันทึกข้อมูลลง Firestore =================
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // เช็คก่อนว่าดึงไอดีคนโพสต์มาได้ไหม ถ้าไม่ได้แปลว่าเน็ตอาจจะหลุด
    if (!currentUserId) {
        showToast('กำลังเชื่อมต่อระบบความปลอดภัย โปรดรอสักครู่ฮับ ⏳', 'error');
        return;
    }

    const formData = {
        type: document.querySelector('input[name="reportType"]:checked').value,
        name: document.getElementById('itemName').value.trim(),
        description: document.getElementById('itemDesc').value.trim(),
        contact: document.getElementById('contactInfo').value.trim(),
        image: base64Output.value || null,
        status: 'active',
        ownerId: currentUserId, // 🛡️ แอบเซฟไอดีของคนที่โพสต์ลงไปด้วย
        createdAt: serverTimestamp()
    };

    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังจดจำข้อมูล... 🐾';
    submitBtn.disabled = true;

    try {
        const reportsRef = collection(db, 'reports');
        await addDoc(reportsRef, formData);
        
        showToast('บันทึกข้อมูลเรียบร้อยแย้ว! ✨', 'success');
        navigateTo('home');
    } catch (error) {
        console.error("Error adding document: ", error);
        showToast('บันทึกไม่สำเร็จ! ขัดข้องทางระบบงับ 🥺', 'error');
    } finally {
        submitBtn.innerHTML = originalBtnHtml;
        submitBtn.disabled = false;
    }
});

// ================= ดึงข้อมูลจาก Firestore =================
function loadReports() {
    listLoader.classList.remove('hidden');
    
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, orderBy('createdAt', 'desc'));
    
    onSnapshot(q, (snapshot) => {
        reportsGrid.innerHTML = '';
        
        if (snapshot.empty) {
            emptyState.classList.remove('hidden');
            listLoader.classList.add('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');

        snapshot.forEach((docSnap) => {
            const report = docSnap.data();
            const docId = docSnap.id;
            const isLost = report.type === 'lost';
            
            const isResolved = report.status === 'resolved';
            
            // 🛡️ เช็คว่าผู้ใช้ที่กำลังเปิดแอปอยู่ เป็นคนเดียวกับคนที่สร้างโพสต์นี้ไหม
            const isOwner = report.ownerId === currentUserId; 
            
            const typeBadge = isLost 
                ? `<span class="bg-indigo-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-md border border-white/20"><i class="fa-solid fa-bullhorn mr-1.5"></i> ตามหาของฮับ</span>`
                : `<span class="bg-pink-400/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-md border border-white/20"><i class="fa-solid fa-gift mr-1.5"></i> เก็บของได้ฮับ</span>`;
            
            const timeString = report.createdAt ? timeAgo(report.createdAt.toDate()) : 'เมื่อกี้เลยฮับ 🐾';

            const imageHtml = report.image 
                ? `<img src="${report.image}" alt="${report.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out">`
                : `<div class="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-200 group-hover:scale-110 transition-transform duration-700 ease-out"><i class="fa-solid fa-image text-5xl mb-2"></i></div>`;

            // ตราประทับสำเร็จ
            const resolvedOverlay = isResolved ? `
                <div class="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-30 flex items-center justify-center rounded-[2rem]">
                    <div class="bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold px-6 py-3 rounded-full shadow-2xl transform -rotate-12 text-2xl border-4 border-white animate-bounce">
                        🎉 คืนของแล้ว!
                    </div>
                </div>
            ` : '';

            // 🛡️ โชว์ปุ่มสำเร็จ เฉพาะเมื่อ 1. ยังไม่สำเร็จ และ 2. เป็นเจ้าของโพสต์เท่านั้น!
            const actionButton = (!isResolved && isOwner) ? `
                <button data-id="${docId}" class="delete-btn absolute top-4 right-4 z-40 bg-white/90 backdrop-blur-md text-pink-500 hover:bg-pink-500 hover:text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 border border-white" title="กดเมื่อเจอของหรือส่งคืนแย้ว! 🎉">
                    <i class="fa-solid fa-check-circle text-xl pointer-events-none"></i>
                </button>
            ` : '';

            const cardHtml = `
                <div class="glass-premium rounded-[2rem] overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group relative border border-white/80 flex flex-col h-full ${isResolved ? 'opacity-90 grayscale-[20%]' : ''}">
                    
                    ${resolvedOverlay}
                    ${actionButton}

                    <div class="relative overflow-hidden aspect-[4/3] w-full">
                        ${imageHtml}
                        <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div class="absolute top-4 left-4 z-10">${typeBadge}</div>
                    </div>
                    
                    <div class="p-6 flex flex-col flex-grow bg-white/60">
                        <h3 class="font-bold text-xl text-luxury-navy mb-2 line-clamp-1">${report.name}</h3>
                        <p class="text-gray-600 text-sm mb-6 line-clamp-2 leading-relaxed flex-grow font-light">${report.description}</p>
                        
                        <div class="bg-white/80 rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">ติดต่อเพื่อนด่วนๆ 🏃‍♂️</p>
                            <p class="font-medium text-luxury-navy flex items-center">
                                <span class="w-8 h-8 rounded-full bg-green-100 text-green-500 flex items-center justify-center mr-3">
                                    <i class="fa-brands fa-line text-lg animate-pulse"></i>
                                </span>
                                ${report.contact}
                            </p>
                        </div>
                        
                        <div class="flex justify-between items-center text-xs font-medium text-gray-400 pt-2 border-t border-gray-200/60">
                            <span class="flex items-center"><i class="fa-regular fa-clock mr-1.5"></i> ${timeString}</span>
                        </div>
                    </div>
                </div>
            `;
            reportsGrid.insertAdjacentHTML('beforeend', cardHtml);
        });
        listLoader.classList.add('hidden');
    }, (error) => {
        console.error("Error fetching reports:", error);
        listLoader.classList.add('hidden');
    });
}

// ================= ระบบสร้างบัญชีผู้ใช้อัตโนมัติ (Anonymous Auth) =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // มีผู้ใช้อยู่แล้ว เก็บ ID ประจำเครื่องไว้
        currentUserId = user.uid;
        // โหลดข้อมูลขึ้นมาโชว์หลังจากรู้ว่าใครเป็นคนเปิดเว็บ
        loadReports(); 
    } else {
        // ถ้าเข้าเว็บครั้งแรก ให้ระบบแอบสมัครไอดีให้เลย (แบบไม่ขออีเมล)
        signInAnonymously(auth).catch((error) => {
            console.error("Auth Error: ", error);
            showToast('ระบบเกิดข้อผิดพลาดในการยืนยันตัวตนฮับ', 'error');
        });
    }
});
