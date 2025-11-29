// --- content.js (最終版: 自動ロード + 検索バーのみ) ---

const PRIMARY_TARGET_SELECTOR = 'ytd-playlist-video-list-renderer'; 
const TABS_WRAPPER_SELECTOR = '#tabs-inner'; 
const TOTAL_COUNT_SELECTOR = '#stats .yt-formatted-string:nth-child(1)'; 
const SHOW_MORE_BUTTON_SELECTOR = 'ytd-page-manager:not([hidden]) ytd-playlist-header-renderer #view-more-text, ytd-page-manager:not([hidden]) ytd-playlist-header-renderer ytd-button-renderer a[href*="view_all"]';

let playlistData = []; 
let checkInterval = null; 
let lastUrl = window.location.href; 
const RELOAD_FLAG = 'playlist_ui_reloaded_once';

// --------------------------------------------------------
// ヘルパー関数: URLから現在のプレイリストIDを抽出
// --------------------------------------------------------
function getCurrentPlaylistId(url) {
    try {
        const urlParams = new URLSearchParams(new URL(url).search);
        return urlParams.get('list') || '';
    } catch (e) {
        return '';
    }
}

// --------------------------------------------------------
// URL監視とリログのメインロジック 
// --------------------------------------------------------
function urlObserverAndRelog() {
    const currentUrl = window.location.href;
    const isPlaylistPage = currentUrl.includes('playlist?list=');
    const hasReloaded = sessionStorage.getItem(RELOAD_FLAG) === 'true';
    // const currentId = getCurrentPlaylistId(currentUrl); // 未使用のためコメントアウト

    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (!isPlaylistPage) {
            sessionStorage.removeItem(RELOAD_FLAG);
        }
    }

    if (isPlaylistPage) {
        if (!hasReloaded) {
            sessionStorage.setItem(RELOAD_FLAG, 'true');
            window.location.replace(currentUrl); 
            return;
        } else {
            if (checkInterval === null) {
                setTimeout(startInjectionLoop, 500); 
            }
        }
    } else {
        if (checkInterval !== null) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }
}

// --------------------------------------------------------
// 「全体を見る」ボタンにリログ処理を追加する関数
// --------------------------------------------------------
function attachReloadToViewAllButton() {
    const viewAllButtons = document.querySelectorAll(SHOW_MORE_BUTTON_SELECTOR);
    
    viewAllButtons.forEach(button => {
        if (!button.getAttribute('data-reload-attached')) {
            button.addEventListener('click', (e) => {
                if (window.location.href.includes('playlist?list=')) {
                    e.preventDefault(); 
                    e.stopImmediatePropagation();
                    
                    console.log("「全体を見る」ボタンがクリックされました。強制リロードを実行します。");
                    
                    sessionStorage.removeItem(RELOAD_FLAG); 
                    
                    window.location.replace(button.href || window.location.href); 
                }
            }, { once: true }); 
            
            button.setAttribute('data-reload-attached', 'true');
        }
    });
}

// --------------------------------------------------------
// UIの挿入と初期化を行うメイン関数
// --------------------------------------------------------
function injectUIAndLoadPlaylist() {
    
    const listRenderer = document.querySelector(PRIMARY_TARGET_SELECTOR); 
    
    attachReloadToViewAllButton(); 

    if (!listRenderer) return;

    // UIが既に存在する場合は終了
    if (document.getElementById('final-functional-control-panel')) {
        if (checkInterval !== null) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
        return;
    }

    const tabsWrapper = listRenderer.closest('ytd-c4-tabbed-header-renderer') ? 
                        listRenderer.closest('ytd-c4-tabbed-header-renderer').querySelector(TABS_WRAPPER_SELECTOR) :
                        null;

    const controlPanel = document.createElement('div');
    controlPanel.id = 'final-functional-control-panel';
    controlPanel.style.cssText = `
        width: 100%; 
        padding: 0 24px 16px 24px; 
        box-sizing: border-box; 
        z-index: 100; 
        background-color: transparent; 
        border-bottom: 1px solid #303030; 
        margin-top: 10px;
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'リスト内の動画を検索...';
    searchInput.id = 'injected-search-bar';
    
    // モダンデザイン適用
    searchInput.style.cssText = `
        width: 100%; 
        padding: 10px 16px; 
        margin-bottom: 10px; 
        background-color: transparent; 
        color: white; 
        border: 1px solid #4d4d4d; 
        border-radius: 20px; 
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); 
        transition: border-color 0.3s, box-shadow 0.3s;
        box-sizing: border-box;
    `;
    
    // フォーカス時のスタイルをイベントリスナーで追加
    searchInput.addEventListener('focus', function() {
        this.style.borderColor = '#ffffff'; 
        this.style.boxShadow = '0 0 0 1px #ffffff'; 
    });

    searchInput.addEventListener('blur', function() {
        this.style.borderColor = '#4d4d4d'; 
        this.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.4)';
    });

    // ★ ボタンコンテナを削除 (または空にする) ★
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-bottom: -10px;'; 
    // ※ このコンテナ自体は残しても構いませんが、今回はボタンがないため、マージンを調整して検索バーに近づけます

    // ★ ボタンの追加は行いません ★

    controlPanel.appendChild(searchInput);
    // controlPanel.appendChild(buttonContainer); // ボタンがないため、この行は省略または空のまま

    if (tabsWrapper) tabsWrapper.insertAdjacentElement('afterend', controlPanel);
    else listRenderer.insertAdjacentElement('beforebegin', controlPanel);

    searchInput.addEventListener('input', handleSearch);

    loadPlaylistFromPage();

    if (checkInterval !== null) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    
    attachReloadToViewAllButton();
    
    // 自動ロードは初回ロード時に実行
    if (getTotalVideoCount() > 0) {
        handleLoadAllVideos();
    }
}

// --------------------------------------------------------
// 実行制御ロジック
// --------------------------------------------------------
function startInjectionLoop() {
    if (checkInterval !== null) return;
    checkInterval = setInterval(injectUIAndLoadPlaylist, 250);
}

// ★ URL監視とリログトリガーを常時実行
setInterval(urlObserverAndRelog, 100);

// --------------------------------------------------------
// ヘルパー関数 (ロード、UI)
// --------------------------------------------------------
function getTotalVideoCount() {
    const totalCountElement = document.querySelector(TOTAL_COUNT_SELECTOR);
    if (!totalCountElement) return 0;

    const text = totalCountElement.textContent.trim();
    const countMatch = text.match(/[\d,]+/);
    if (countMatch) return parseInt(countMatch[0].replace(/,/g, ''), 10);
    return 0;
}

async function safeScrollToLastElement(lastElement) {
    if (!lastElement) {
        window.scrollBy(0, 500); 
    } else {
        const rect = lastElement.getBoundingClientRect();
        const offset = 200; 
        const targetY = window.scrollY + rect.top - window.innerHeight + offset;
        window.scrollTo({ top: targetY, behavior: "smooth" });
    }
    await new Promise(r => setTimeout(r, 1500)); 
}

function showLoadingOverlay() {
    let overlay = document.getElementById('playlist-loader-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'playlist-loader-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8); 
            color: white;
            z-index: 99999; 
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24px;
            font-weight: bold;
            flex-direction: column;
        `;
        
        const text = document.createElement('div');
        text.textContent = 'プレイリストをロード中...';
        overlay.appendChild(text);

        const spinner = document.createElement('div');
        spinner.className = 'loader-spinner';
        spinner.style.cssText = `
            border: 8px solid #f3f3f3; 
            border-top: 8px solid #ff0000; 
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-top: 15px;
        `;
        overlay.appendChild(spinner);
        
        document.body.appendChild(overlay);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('playlist-loader-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// --------------------------------------------------------
// ※ UIから削除しましたが、自動ロードのロジックとして維持
// --------------------------------------------------------
function handleLoadAllVideos(button) {
    const controlPanel = document.getElementById('final-functional-control-panel'); 
    const isAutomaticLoad = !button; // ボタンがない場合は自動ロード

    if (!isAutomaticLoad) { // ボタンがクリックされた場合の処理（今回はUIにボタンがないため実行されない）
        // ... (ボタン処理を省略)
    }

    const totalGoal = getTotalVideoCount();
    if (totalGoal === 0) {
        hideLoadingOverlay();
        return;
    }

    loadPlaylistFromPage();
    let currentCount = playlistData.length;

    async function continuousLoad() {
        let stableCountAttempts = 0;
        const MAX_STABLE_ATTEMPTS = 10;
        showLoadingOverlay(); // 自動ロード開始時にもオーバーレイを表示

        while (currentCount < totalGoal) {
            
            loadPlaylistFromPage();
            currentCount = playlistData.length;

            if (currentCount >= totalGoal) break;

            const lastVideoElement = playlistData[currentCount - 1] ? playlistData[currentCount - 1].domElement : null;
            
            await safeScrollToLastElement(lastVideoElement);
            
            // console.log(`[自動ロード] ${currentCount} / ${totalGoal} 件読み込み中...`);
            
            loadPlaylistFromPage();
            const newCount = playlistData.length;

            if (newCount > currentCount) {
                currentCount = newCount;
                stableCountAttempts = 0;
            } else {
                stableCountAttempts++;
                if (stableCountAttempts >= MAX_STABLE_ATTEMPTS) {
                    console.log("動画数が増加しませんでした。ロードを終了します。");
                    break;
                }
            }
        }
        
        hideLoadingOverlay(); 

        loadPlaylistFromPage();
        const finalCount = playlistData.length;

        if (controlPanel) {
            // console.log("[Scroll] Scrolling back to control panel.");
            const uiTopPosition = controlPanel.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: uiTopPosition, behavior: 'smooth' });
        }

        console.log(`[自動ロード] 完了。最終件数: ${finalCount} 件`);
    }

    continuousLoad();
}

// --------------------------------------------------------
// ※ UIから削除しましたが、後続の機能追加のために残します
// --------------------------------------------------------
function createButton(text, clickHandler) {
    const button = document.createElement('button');
    // ... (スタイリングの省略)
    button.textContent = text;
    button.addEventListener('click', () => clickHandler(button)); 
    return button;
}

function loadPlaylistFromPage() {
    playlistData = []; 
    const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');

    videoElements.forEach(element => {
        const titleElement = element.querySelector('#video-title');
        const linkElement = element.querySelector('a#video-title'); 

        if (titleElement && linkElement) {
            playlistData.push({
                originalTitle: titleElement.textContent.trim(),
                titleElement: titleElement,
                url: linkElement.href, 
                domElement: element,
                isUnavailable: false 
            });
        }
        // 動画が削除されている場合
        else if (element.querySelector('yt-formatted-string[id="index-text"]')) {
             playlistData.push({
                originalTitle: element.querySelector('yt-formatted-string[id="index-text"]').textContent.trim() + ' (削除/非公開)',
                titleElement: element.querySelector('yt-formatted-string[id="index-text"]'),
                url: '', 
                domElement: element,
                isUnavailable: true 
            });
        }
    });
}

// --------------------------------------------------------
// ※ UIから削除しましたが、後続の機能追加のために残します
// --------------------------------------------------------
function handleHideUnavailable(button) {
    const isHidden = button.getAttribute('data-hidden') === 'true';
    const newState = !isHidden;

    loadPlaylistFromPage(); 

    let count = 0;
    playlistData.forEach(video => {
        if (video.isUnavailable && video.domElement) {
            // 削除・非公開動画は、非表示状態がトグルされるまでそのまま
            video.domElement.style.display = newState ? 'none' : '';
            count++;
        }
    });

    if (newState) {
        button.setAttribute('data-hidden', 'true');
    } else {
        button.setAttribute('data-hidden', 'false');
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.trim();
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    
    // 現在の「削除動画非表示」状態を確認
    // UIにボタンがないため、この機能は動作しなくなりますが、ロジックは残します。
    // デフォルトで非表示機能は無効（false）として扱います。
    const isHidden = false; // UIボタンがないため常にfalse

    playlistData.forEach(video => {
        const originalTitle = video.originalTitle;
        const domElement = video.domElement;
        const titleElement = video.titleElement;

        // 常にオリジナルタイトルに戻す
        if (titleElement) titleElement.innerHTML = originalTitle; 

        if (domElement) {
            const isMatch = originalTitle.toLowerCase().includes(searchTerm.toLowerCase());
            
            // 検索結果の表示/非表示を決定
            if (isMatch && searchTerm.length > 0) {
                 // マッチしたら表示
                domElement.style.display = '';
                // ハイライト処理
                if (titleElement) {
                    const highlightedTitle = originalTitle.replace(regex, '<mark style="background-color: yellow; color: black; padding: 0 1px;">$&</mark>');
                    titleElement.innerHTML = highlightedTitle;
                }
            } else if (video.isUnavailable && isHidden) {
                // マッチせず、かつ削除動画非表示が有効な場合は非表示（現在はisHidden=falseのため実行されない）
                domElement.style.display = 'none';
            } else if (!isMatch && searchTerm.length > 0) {
                // マッチせず、検索バーに文字があれば非表示
                 domElement.style.display = 'none';
            } else {
                // 検索バーが空の場合は全て表示
                domElement.style.display = '';
            }
        }
    });
}