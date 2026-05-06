// --- [1] 설정 및 아이콘 매핑 ---
const LOCATIONS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_PER_SLOT = 10; 

const OVERLAY_ICONS = {
    normal: '', 
    heart: 'icon-heart',   
    skull: 'icon-skull', 
    special: 'icon-special',
    time: 'icon-time'   
};

let gameState = JSON.parse(sessionStorage.getItem('shieldState')) || {};
if (Object.keys(gameState).length === 0) {
    LOCATIONS.forEach(loc => gameState[loc] = [null, null, null]);
}

let currentLocation = 'A';
let isNavClicking = false;
let scrollTimeout = null;

let currentModalCount = 3; 

// --- [2] 초기화 및 렌더링 ---
function init() {
    renderMaps();
    setupNavigation();
    setupSwipeDetection();

    document.getElementById('shield-type-selection').addEventListener('click', (e) => {
        const btn = e.target.closest('button'); 
        if(!btn) return;

        if (btn.id === 'btn-remove') {
            currentModalCount = 0; 
            confirmModal();        
            return; 
        }

        document.querySelectorAll('#shield-type-selection button:not(#btn-remove)').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });

    document.getElementById('btn-minus').addEventListener('click', () => {
        if (currentModalCount > 1) { 
            currentModalCount--;
            updateModalCountDisplay();
        }
    });

    document.getElementById('btn-plus').addEventListener('click', () => {
        let maxLimit = activeContext.type === 'slot' ? MAX_PER_SLOT : MAX_PER_SLOT * 3;
        if (currentModalCount < maxLimit) {
            currentModalCount++;
            updateModalCountDisplay();
        }
    });

    document.getElementById('shield-count-display').addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        let maxLimit = activeContext.type === 'slot' ? MAX_PER_SLOT : MAX_PER_SLOT * 3;
        
        if (isNaN(val) || val < 1) val = 1;
        if (val > maxLimit) val = maxLimit;
        
        currentModalCount = val;
    });
    
    document.getElementById('shield-count-display').addEventListener('blur', updateModalCountDisplay);

    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-confirm').addEventListener('click', confirmModal);

    document.getElementById('btn-help').addEventListener('click', () => {
        document.getElementById('help-modal-overlay').classList.remove('hidden');
    });

    document.getElementById('btn-close-help').addEventListener('click', () => {
        document.getElementById('help-modal-overlay').classList.add('hidden');
    });

    // 전체 삭제 버튼
    document.getElementById('btn-clear-all').addEventListener('click', () => {
        if (confirm('현재 저장된 모든 방패 데이터를 초기화하시겠습니까?')) {
            sessionStorage.removeItem('shieldState');
            location.reload(); 
        }
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    });
    
    document.getElementById('help-modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('help-modal-overlay').classList.add('hidden');
        }
    });
}

function updateModalCountDisplay() {
    document.getElementById('shield-count-display').value = currentModalCount; 
}

function renderMaps() {
    const container = document.getElementById('map-container');
    container.innerHTML = '';

    LOCATIONS.forEach(locName => {
        const card = document.createElement('div');
        card.className = 'location-card';
        card.id = `loc-${locName}`;

        const title = document.createElement('h2');
        title.innerText = locName;
        addLongTapListener(title, () => handleLocationLongTap(locName));

        const slotsDiv = document.createElement('div');
        slotsDiv.className = 'slots-container';

        gameState[locName].forEach((slotData, index) => {
            const slotWrapper = document.createElement('div');
            slotWrapper.className = 'slot-wrapper';

            const slot = document.createElement('div');
            slot.className = 'slot';
            
            addLongTapListener(slot, () => handleSlotLongTap(locName, index));

            slot.addEventListener('mousemove', (e) => {
                if (!slot.classList.contains('filled')) return;
                
                const rect = slot.getBoundingClientRect();
                const x = e.clientX - rect.left; 
                const y = e.clientY - rect.top;  
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = ((y - centerY) / centerY) * -15; 
                const rotateY = ((x - centerX) / centerX) * 15;

                slot.style.transform = `translateY(-10px) scale(1.05) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            slot.addEventListener('mouseleave', () => {
                if (!slot.classList.contains('filled')) return;
                slot.style.transform = ''; 
            });

            slot.addEventListener('click', (e) => {
                if (slot.dataset.longTapped === 'true') return;

                // 숫자가 들어있는 뱃지를 클릭하면 모달 띄우기 처리 후 바로 종료
                if (e.target.closest('.count-badge')) {
                    handleSlotLongTap(locName, index); 
                    return; 
                }
                
                slot.classList.remove('tap-anim');
                void slot.offsetWidth; 
                slot.classList.add('tap-anim'); 
                
                const currentData = gameState[locName][index];
                if (currentData) {
                    currentData.count--;
                    sessionStorage.setItem('shieldState', JSON.stringify(gameState)); 

                    if (currentData.count <= 0) {
                        setTimeout(() => {
                            gameState[locName][index] = null;
                            saveAndRender(); 
                        }, 300);
                    } else {
                        const badge = slot.querySelector('.count-badge');
                        if (badge) badge.innerText = currentData.count;
                    }
                } else {
                    setTimeout(() => {
                        handleSlotLongTap(locName, index); 
                        slot.classList.remove('tap-anim');
                    }, 200); 
                }
            });

            if (slotData) {
                slot.classList.add('filled'); 
                const iconId = OVERLAY_ICONS[slotData.type];
                const overlaySvg = iconId 
                    ? `<svg class="overlay-icon"><use href="#${iconId}"></use></svg>` 
                    : '';

                slot.innerHTML = `
                    <div class="shield-wrapper">
                        <svg class="base-shield"><use href="#icon-shield-base"></use></svg>
                        ${overlaySvg}
                    </div>
                    <div class="count-badge">${slotData.count}</div>
                `;
            } else {
                slot.classList.remove('filled');
                slot.innerHTML = '<span class="empty-plus">+</span>';
            }
            
            slotWrapper.appendChild(slot);
            slotsDiv.appendChild(slotWrapper);
        });

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        
        contentWrapper.appendChild(slotsDiv); 
        contentWrapper.appendChild(title);    

        card.appendChild(contentWrapper);
        container.appendChild(card);
    });
}

function saveAndRender() {
    sessionStorage.setItem('shieldState', JSON.stringify(gameState));
    renderMaps();
}

// --- [3] 롱탭 로직 ---
function addLongTapListener(el, callback) {
    let timer;
    const start = () => {
        el.dataset.longTapped = 'false';
        timer = setTimeout(() => {
            el.dataset.longTapped = 'true';
            callback();
        }, 500);
    };
    const stop = () => clearTimeout(timer);
    el.addEventListener('touchstart', start, {passive: true});
    el.addEventListener('touchend', stop);
    el.addEventListener('touchmove', stop);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', stop);
}

// --- [4] 모달 & 액션 ---
let activeContext = null;

function handleSlotLongTap(loc, idx) {
    activeContext = { type: 'slot', loc, idx };
    const data = gameState[loc][idx];
    document.getElementById('modal-title').innerText = '방패 설정';
    document.getElementById('shield-type-selection').style.display = 'flex';
    
    currentModalCount = data ? data.count : 3; 
    updateModalCountDisplay();
    
    document.querySelectorAll('#shield-type-selection button:not(#btn-remove)').forEach(b => b.classList.remove('selected'));
    const activeType = data ? data.type : 'normal';
    document.querySelector(`#shield-type-selection button[data-type="${activeType}"]`).classList.add('selected');

    document.getElementById('modal-overlay').classList.remove('hidden');
}

function handleLocationLongTap(loc) {
    activeContext = { type: 'loc', loc };
    document.getElementById('modal-title').innerText = `${loc} 일괄 제거`;
    document.getElementById('shield-type-selection').style.display = 'none';
    
    currentModalCount = 1; 
    updateModalCountDisplay();

    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

function confirmModal() {
    const count = currentModalCount; 
    if (activeContext.type === 'slot') {
        const type = document.querySelector('#shield-type-selection .selected')?.dataset.type || 'normal';
        gameState[activeContext.loc][activeContext.idx] = count > 0 ? { type, count } : null;
    } else {
        let toRemove = count;
        for(let i=0; i<3; i++) {
            if(!gameState[activeContext.loc][i]) continue;
            if(gameState[activeContext.loc][i].count > toRemove) {
                gameState[activeContext.loc][i].count -= toRemove;
                toRemove = 0; break;
            } else {
                toRemove -= gameState[activeContext.loc][i].count;
                gameState[activeContext.loc][i] = null;
            }
        }
    }
    saveAndRender();
    closeModal();
}

// --- [5] 화면 이동 감지 ---
function setupNavigation() {
    document.querySelectorAll('#top-nav button[data-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            
            isNavClicking = true;
            clearTimeout(scrollTimeout); 

            document.querySelectorAll('#top-nav button[data-target]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLocation = targetId.split('-')[1];

            document.getElementById(targetId).scrollIntoView({ behavior: 'smooth' });

            scrollTimeout = setTimeout(() => {
                isNavClicking = false;
            }, 600);
        });
    });
}

function setupSwipeDetection() {
    const container = document.getElementById('map-container');
    
    const observer = new IntersectionObserver((entries) => {
        if (isNavClicking) return;

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const newLoc = entry.target.id.split('-')[1];
                if (currentLocation !== newLoc) {
                    currentLocation = newLoc; 
                    
                    document.querySelectorAll('#top-nav button[data-target]').forEach(b => b.classList.remove('active'));
                    const activeBtn = document.querySelector(`button[data-target="loc-${newLoc}"]`);
                    if(activeBtn) activeBtn.classList.add('active');
                }
            }
        });
    }, { 
        root: container, 
        threshold: 0.5 
    }); 
    
    document.querySelectorAll('.location-card').forEach(c => observer.observe(c));
}

init();