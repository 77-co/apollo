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
        this.filteredNews = [];
        this.updateInterval = null;
        this.progressInterval = null;
        this.backgroundLoadInterval = null;
        this.progressValue = 0;
        this.currentSource = 'world';
        this.isLoading = false;
        this.isPaused = false;
        this.searchQuery = '';
        this.currentFilter = 'all';
        
        this.articleCount = 5;
        this.progressSpeed = 6000;
        this.sources = ['tech_science', 'world', 'business', 'sport'];
        this.currentSourceIndex = 0;
        
        this.currentTime = new Date('2025-06-22T17:03:57Z');
        
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
        // Search functionality
        const searchInput = document.querySelector('#newsSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.debounce(() => this.filterAndDisplayNews(), 300)();
            });
        }

        // Clear search
        const clearSearchBtn = document.querySelector('#clearNewsSearch');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Category filters
        document.querySelectorAll('.news-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFilter = e.currentTarget.dataset.filter;
                document.querySelectorAll('.news-filter-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterAndDisplayNews();
            });
        });

        // Refresh button
        const refreshBtn = document.querySelector('#refreshNewsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshAllNews();
            });
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async refreshAllNews() {
        const refreshBtn = document.querySelector('#refreshNewsBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }

        try {
            await this.loadAllCategories();
            this.filterAndDisplayNews();
            
            // Keep spinning for 1.5 seconds to show success
            setTimeout(() => {
                if (refreshBtn) {
                    refreshBtn.classList.remove('loading');
                }
            }, 1500);
            
        } catch (error) {
            console.error('Failed to refresh news:', error);
            
            // Stop spinning immediately on error and add error state
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.classList.add('error');
                
                // Remove error state after 2 seconds
                setTimeout(() => {
                    refreshBtn.classList.remove('error');
                }, 2000);
            }
        }
    }

    filterAndDisplayNews() {
        let allNews = [];
        
        // Combine all news from all categories
        Object.keys(this.allCategoryNews).forEach(source => {
            const articles = this.allCategoryNews[source] || [];
            allNews = allNews.concat(articles.map(article => ({
                ...article,
                category: source
            })));
        });

        // Apply category filter
        if (this.currentFilter !== 'all') {
            allNews = allNews.filter(article => article.category === this.currentFilter);
        }

        // Apply search filter
        if (this.searchQuery) {
            allNews = allNews.filter(article => 
                article.title.toLowerCase().includes(this.searchQuery) ||
                (article.summary && article.summary.toLowerCase().includes(this.searchQuery)) ||
                (article.author && article.author.toLowerCase().includes(this.searchQuery))
            );
            
            // Show/hide clear search button
            const clearBtn = document.querySelector('#clearNewsSearch');
            if (clearBtn) {
                clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
            }
        }

        // Sort by timestamp (newest first)
        allNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        this.filteredNews = allNews;
        this.updateNewsAppWithFiltered();
    }

    updateNewsApp() {
        this.filterAndDisplayNews();
    }

    updateNewsAppWithFiltered() {
        const newsFeed = document.querySelector('.news-feed');
        const newsCount = document.querySelector('.news-count');
        
        if (!newsFeed) return;
        
        // Update count
        if (newsCount) {
            newsCount.textContent = `${this.filteredNews.length} artykułów`;
        }
        
        newsFeed.innerHTML = '';
        
        if (this.filteredNews.length === 0) {
            const emptyState = this.searchQuery ? 
                `<div class="no-articles">
                    <span class="material-symbols-outlined">search_off</span>
                    <h3>Brak wyników</h3>
                    <p>Nie znaleziono artykułów dla "${this.searchQuery}"</p>
                </div>` :
                `<div class="no-articles">
                    <span class="material-symbols-outlined">article</span>
                    <h3>Brak artykułów</h3>
                    <p>Brak artykułów w tej kategorii</p>
                </div>`;
            
            newsFeed.innerHTML = emptyState;
            return;
        }
        
        this.filteredNews.forEach((news, index) => {
            const articleElement = document.createElement('div');
            articleElement.className = 'news-article';
            
            const categoryName = this.getCategoryDisplayName(news.category);
            const isRecent = this.isRecentArticle(news.timestamp);
            
            articleElement.innerHTML = `
                <div class="article-card">
                    ${isRecent ? '<div class="new-badge">NOWE</div>' : ''}
                    <div class="article-header">
                        <span class="article-category">${categoryName}</span>
                        <span class="article-time">${this.formatTimestamp(news.timestamp)}</span>
                    </div>
                    <h2 class="article-title">${news.title}</h2>
                    <div class="article-source">${news.source}</div>
                </div>
            `;
            
            articleElement.addEventListener('click', () => {
                this.openFullArticle(news);
            });
            
            newsFeed.appendChild(articleElement);
        });
    }

    getCategoryDisplayName(category) {
        const categoryNames = {
            'tech_science': 'Tech',
            'world': 'Świat',
            'business': 'Biznes',
            'sport': 'Sport'
        };
        return categoryNames[category] || category;
    }

    isRecentArticle(timestamp) {
        const articleTime = new Date(timestamp);
        const diffHours = (this.currentTime - articleTime) / (1000 * 60 * 60);
        return diffHours < 2; // Articles newer than 2 hours are "new"
    }

    clearSearch() {
        this.searchQuery = '';
        document.querySelector('#newsSearchInput').value = '';
        document.querySelector('#clearNewsSearch').style.display = 'none';
        this.filterAndDisplayNews();
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
            translateX: [0, -15],
            duration: 200,
            easing: "easeInCubic",
            complete: () => {
                this.headlineElement.textContent = currentNews.title;
                this.timestampElement.textContent = this.formatTimestamp(currentNews.timestamp);
                this.sourceElement.textContent = currentNews.source;
                this.currentIndexElement.textContent = this.currentIndex + 1;

                anime({
                    targets: [this.headlineElement, this.timestampElement],
                    opacity: [0, 1],
                    translateX: [15, 0],
                    duration: 200,
                    easing: "easeOutCubic",
                });
            },
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
            return `${days}d`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else if (minutes > 0) {
            return `${minutes}m`;
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