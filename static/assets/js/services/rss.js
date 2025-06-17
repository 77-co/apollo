class RSSWidget {
    constructor() {
        this.widget = document.getElementById('rss');
        this.headlineElement = this.widget.querySelector('.headline');
        this.timestampElement = this.widget.querySelector('.timestamp');
        this.sourceElement = this.widget.querySelector('.source');
        this.currentIndexElement = this.widget.querySelector('.current');
        this.totalElement = this.widget.querySelector('.total');
        this.progressFill = this.widget.querySelector('.progress-fill');
        this.progressContainer = this.widget.querySelector('.progress-container');
        
        this.currentIndex = 0;
        this.newsItems = [];
        this.allCategoryNews = {};
        this.updateInterval = null;
        this.progressInterval = null;
        this.backgroundLoadInterval = null;
        this.progressValue = 0;
        this.currentSource = 'world';
        this.isLoading = false;
        this.isPaused = false;
        
        this.articleCount = 5;
        this.progressSpeed = 6000;
        this.sources = ['tech_science', 'world', 'business', 'sport'];
        this.currentSourceIndex = 0;
        
        this.currentTime = new Date('2025-06-06T07:22:54Z');
        
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadNewsForSource(this.currentSource);
            this.displayCurrentNews();
            this.setupEventListeners();
            this.startProgressTimer();
            this.startBackgroundLoading();
            
            setTimeout(() => {
                this.widget.querySelector('.rssLoginAlert').classList.remove('active');
            }, 2000);
            
        } catch (error) {
            console.error('[RSS Widget] Initialization failed:', error);
            this.showErrorState();
            this.retryInitialization();
        }
    }

    async startBackgroundLoading() {
        await this.loadAllCategories();
        
        this.backgroundLoadInterval = setInterval(async () => {
            await this.loadAllCategories();
        }, 15 * 60 * 1000);
    }

    async loadAllCategories() {
        for (const source of this.sources) {
            try {
                const response = await window.backend.rss.getNews(source);
                
                if (response && response.success && response.news && response.news.length >= 5) {
                    this.allCategoryNews[source] = response.news;
                } else {
                    console.warn(`[RSS Widget] Failed to load sufficient articles for ${source}`);
                }
            } catch (error) {
                console.error(`[RSS Widget] Background loading failed for ${source}:`, error);
            }
        }
        
        this.updateNewsApp();
    }

    async retryInitialization() {
        for (let i = 0; i < this.sources.length; i++) {
            try {
                this.currentSourceIndex = (this.currentSourceIndex + 1) % this.sources.length;
                this.currentSource = this.sources[this.currentSourceIndex];
                
                await this.loadNewsForSource(this.currentSource);
                this.displayCurrentNews();
                this.startProgressTimer();
                return;
            } catch (error) {
                console.warn(`[RSS Widget] Source ${this.currentSource} failed, trying next...`);
            }
        }
        
        this.showErrorState();
        setTimeout(() => this.retryInitialization(), 5 * 60 * 1000);
    }

    async loadNewsForSource(source) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            this.showLoadingState();
            
            const response = await window.backend.rss.getNews(source);
            
            if (response && response.success && response.news && response.news.length >= 5) {
                this.currentSource = source;
                this.newsItems = response.news.slice(0, this.articleCount);
                this.currentIndex = 0;
                this.updateTotalCount();
                
                this.allCategoryNews[source] = response.news;
                
            } else {
                console.error('[RSS Widget] Insufficient articles from RSS service:', response);
                throw new Error(response?.error || 'Insufficient articles available');
            }
        } catch (error) {
            console.error(`[RSS Widget] Error loading RSS news for ${source}:`, error);
            throw error;
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        if (this.headlineElement) {
            this.headlineElement.textContent = 'Ładowanie najnowszych wiadomości...';
            this.timestampElement.textContent = '';
            this.sourceElement.textContent = 'RSS';
        }
        this.pauseProgress();
    }

    hideLoadingState() {
        this.resumeProgress();
    }

    showErrorState() {
        if (this.headlineElement) {
            this.headlineElement.textContent = 'Błąd ładowania wiadomości';
            this.timestampElement.textContent = this.formatTimestamp(this.currentTime);
            this.sourceElement.textContent = 'RSS Error';
            this.currentIndexElement.textContent = '0';
            this.totalElement.textContent = '0';
        }
        this.pauseProgress();
    }

    setupEventListeners() {
        document.querySelectorAll('#newsApp .source-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const source = e.currentTarget.dataset.source;
                this.switchSourceFromApp(source);
            });
        });
    }

    async switchSourceFromApp(source) {
        document.querySelectorAll('#newsApp .source-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`#newsApp .source-item[data-source="${source}"]`)?.classList.add('active');
        
        if (this.allCategoryNews[source] && this.allCategoryNews[source].length >= 5) {
            this.updateNewsAppWithSource(source);
        } else {
            try {
                await this.loadNewsForSource(source);
                this.updateNewsApp();
            } catch (error) {
                console.error(`[RSS Widget] Failed to switch to source ${source}:`, error);
            }
        }
    }

    displayCurrentNews() {
        if (this.newsItems.length === 0) {
            console.warn('[RSS Widget] No news items to display');
            return;
        }
        
        const currentNews = this.newsItems[this.currentIndex];
        
        anime({
            targets: [this.headlineElement, this.timestampElement],
            opacity: [1, 0],
            translateY: [0, 10],
            duration: 200,
            easing: 'easeInSine',
            complete: () => {
                this.headlineElement.textContent = currentNews.title;
                this.timestampElement.textContent = this.formatTimestamp(currentNews.timestamp);
                this.sourceElement.textContent = currentNews.source;
                this.currentIndexElement.textContent = this.currentIndex + 1;
                
                anime({
                    targets: [this.headlineElement, this.timestampElement],
                    opacity: [0, 1],
                    translateY: [10, 0],
                    duration: 200,
                    easing: 'easeOutSine'
                });
            }
        });
    }

    updateNewsApp() {
        const activeSourceElement = document.querySelector('#newsApp .source-item.active');
        const activeSource = activeSourceElement ? activeSourceElement.dataset.source : 'tech_science';
        
        this.updateNewsAppWithSource(activeSource);
    }

    updateNewsAppWithSource(source) {
        const newsFeed = document.querySelector('#newsApp .news-feed');
        if (!newsFeed) return;
        
        const articles = this.allCategoryNews[source] || [];
        
        newsFeed.innerHTML = '';
        
        if (articles.length === 0) {
            newsFeed.innerHTML = '<div class="no-articles">Brak artykułów do wyświetlenia</div>';
            return;
        }
        
        articles.forEach((news, index) => {
            const articleElement = document.createElement('div');
            articleElement.className = 'news-article';
            articleElement.innerHTML = `
                <div class="article-header">
                    <h2 class="article-title">${news.title}</h2>
                    <span class="article-source">${news.source}</span>
                </div>
                <div class="article-footer">
                    <span class="article-time">${this.formatTimestamp(news.timestamp)}</span>
                    <span class="article-author">${news.author || 'Autor nieznany'}</span>
                </div>
            `;
            
            articleElement.addEventListener('click', () => {
                this.openFullArticle(news);
            });
            
            newsFeed.appendChild(articleElement);
        });
    }

    openFullArticle(article) {
        const fullArticleView = document.getElementById('fullArticleView');
        if (!fullArticleView) {
            this.createFullArticleView();
        }
        
        document.querySelector('#fullArticleView .full-article-title').textContent = article.title;
        document.querySelector('#fullArticleView .full-article-source').textContent = article.source;
        document.querySelector('#fullArticleView .full-article-author').textContent = article.author || 'Autor nieznany';
        document.querySelector('#fullArticleView .full-article-time').textContent = this.formatTimestamp(article.timestamp);
        
        const content = article.fullContent || article.summary;
        const contentElement = document.querySelector('#fullArticleView .full-article-content');
        
        contentElement.innerHTML = this.formatContentForDisplay(content);
        
        const closeButton = document.getElementById('closeAppButton');
        anime({
            targets: closeButton,
            opacity: [1, 0],
            scale: [1, 0.8],
            duration: 200,
            easing: 'easeInSine',
            complete: () => {
                closeButton.style.display = 'none';
                document.getElementById('fullArticleView').classList.add('active');
                document.getElementById('newsApp').classList.add('article-open');
            }
        });
    }

    formatContentForDisplay(content) {
        if (!content) return '';
        
        return content
            .split('\n\n')
            .map(paragraph => {
                if (!paragraph.trim()) return '';
                
                const lines = paragraph.split('\n');
                if (lines.length === 2 && lines[1].match(/^=+$/)) {
                    return `<h2 class="article-heading">${lines[0]}</h2>`;
                }
                
                if (paragraph.includes('• ')) {
                    const listItems = paragraph
                        .split('\n')
                        .filter(line => line.includes('• '))
                        .map(line => `<li>${line.replace('• ', '')}</li>`)
                        .join('');
                    return `<ul class="article-list">${listItems}</ul>`;
                }
                
                return `<p class="article-paragraph">${paragraph.replace(/\n/g, '<br>')}</p>`;
            })
            .filter(p => p)
            .join('');
    }

    createFullArticleView() {
        const fullArticleHTML = `
            <div class="app" id="fullArticleView">
                <div class="full-article-header">
                    <button class="back-button" onclick="window.rssWidget.closeFullArticle()">
                        <span class="material-symbols-outlined">arrow_back</span>
                        Wróć
                    </button>
                </div>
                
                <div class="full-article-content-wrapper">
                    <div class="full-article-meta">
                        <span class="full-article-source"></span>
                        <span class="full-article-time"></span>
                    </div>
                    
                    <h1 class="full-article-title"></h1>
                    
                    <div class="full-article-byline">
                        <span>Autor: </span>
                        <span class="full-article-author"></span>
                    </div>
                    
                    <div class="full-article-content"></div>
                </div>
            </div>
        `;
        
        const appsContainer = document.querySelector('.apps');
        if (appsContainer) {
            appsContainer.insertAdjacentHTML('beforeend', fullArticleHTML);
        }
    }

    closeFullArticle() {
        const closeButton = document.getElementById('closeAppButton');
        
        document.getElementById('fullArticleView').classList.remove('active');
        document.getElementById('newsApp').classList.remove('article-open');
        
        setTimeout(() => {
            closeButton.style.display = 'flex';
            anime({
                targets: closeButton,
                opacity: [0, 1],
                scale: [0.8, 1],
                duration: 200,
                easing: 'easeOutSine'
            });
        }, 100);
    }

    nextNews() {
        if (this.newsItems.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.newsItems.length;
        this.displayCurrentNews();
    }

    updateTotalCount() {
        this.totalElement.textContent = this.newsItems.length;
    }

    startProgressTimer() {
        this.stopProgressTimer();
        
        this.progressValue = 0;
        this.progressFill.style.width = '0%';
        
        const interval = 50;
        const increment = (100 / (this.progressSpeed / interval));
        
        this.progressInterval = setInterval(() => {
            if (!this.isPaused) {
                this.progressValue += increment;
                this.progressFill.style.width = `${Math.min(this.progressValue, 100)}%`;
                
                if (this.progressValue >= 100) {
                    this.progressValue = 0;
                    this.progressFill.style.width = '0%';
                    this.nextNews();
                }
            }
        }, interval);
    }

    stopProgressTimer() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    pauseProgress() {
        this.isPaused = true;
        this.progressContainer.classList.add('progress-paused');
    }

    resumeProgress() {
        this.isPaused = false;
        this.progressContainer.classList.remove('progress-paused');
    }

    formatTimestamp(timestamp) {
        const newsTime = new Date(timestamp);
        const diff = this.currentTime - newsTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} ${days === 1 ? 'dzień' : 'dni'} temu`;
        } else if (hours > 0) {
            return `${hours}h temu`;
        } else if (minutes > 0) {
            return `${minutes}min temu`;
        } else {
            return 'Teraz';
        }
    }

    destroy() {
        this.stopProgressTimer();
        if (this.backgroundLoadInterval) {
            clearInterval(this.backgroundLoadInterval);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.rssWidget = new RSSWidget();
});