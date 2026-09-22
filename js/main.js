document.addEventListener('DOMContentLoaded', () => {
  const mobileComposer = document.querySelector('[data-collapse-on-mobile]');
  if (mobileComposer && window.matchMedia('(max-width: 720px)').matches) {
    mobileComposer.removeAttribute('open');
  }

  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');

  if (toggle && nav) {
    const closeMenu = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menüyü aç');
    };

    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Menüyü kapat' : 'Menüyü aç');
    });

    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  const searchDataElement = document.getElementById('product-search-data');
  let searchProducts = [];
  if (searchDataElement) {
    try {
      const parsedSearchData = JSON.parse(searchDataElement.textContent || '[]');
      if (Array.isArray(parsedSearchData)) searchProducts = parsedSearchData;
    } catch (error) {
      console.error('Ürün arama verileri okunamadı.', error);
    }
  }

  const normalizeSearchText = value => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[×*]/g, 'x')
    .trim();

  const searchWords = [...new Set(searchProducts
    .flatMap(product => [
      product.name,
      product.brand,
      product.category,
      { buyukbas: 'Büyükbaş', kucukbas: 'Küçükbaş', kanatli: 'Kanatlı', aksesuar: 'Aksesuar' }[product.group] || product.group
    ])
    .flatMap(value => String(value || '').split(/\s+/))
    .map(word => word.replace(/[^\p{L}\p{N}-]/gu, '').trim())
    .filter(word => word.length >= 2))]
    .sort((a, b) => a.localeCompare(b, 'tr'));
  const searchPhrases = [...new Set(searchProducts
    .flatMap(product => [
      product.name,
      product.category,
      product.brand ? `${product.brand} ${product.category}` : '',
      { buyukbas: 'Büyükbaş yemleri', kucukbas: 'Küçükbaş yemleri', kanatli: 'Kanatlı yemleri', aksesuar: 'Hayvan aksesuarları' }[product.group] || ''
    ])
    .map(phrase => String(phrase || '').replace(/\s+/g, ' ').trim())
    .filter(phrase => phrase.length >= 3))]
    .sort((a, b) => a.localeCompare(b, 'tr'));

  document.querySelectorAll('[data-product-search]').forEach(form => {
    const input = form.querySelector('input[type="search"]');
    if (!input || !searchProducts.length) return;

    const listId = `${input.id || 'productSearch'}Suggestions`;
    const suggestions = document.createElement('div');
    suggestions.id = listId;
    suggestions.className = 'search-suggestions';
    suggestions.setAttribute('role', 'listbox');
    suggestions.hidden = true;
    form.classList.add('has-suggestions');
    form.appendChild(suggestions);
    input.setAttribute('aria-controls', listId);
    input.setAttribute('aria-expanded', 'false');

    let activeIndex = -1;
    let currentResults = [];
    let suggestionActions = [];

    const closeSuggestions = () => {
      suggestions.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
    };

    const submitSearch = value => {
      input.value = value;
      form.requestSubmit();
    };

    const updateActiveSuggestion = () => {
      const options = Array.from(suggestions.querySelectorAll('[role="option"]'));
      options.forEach((option, index) => {
        const active = index === activeIndex;
        option.classList.toggle('active', active);
        option.setAttribute('aria-selected', String(active));
      });
      if (activeIndex >= 0 && options[activeIndex]) {
        input.setAttribute('aria-activedescendant', options[activeIndex].id);
        options[activeIndex].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    };

    const renderSuggestions = () => {
      const query = normalizeSearchText(input.value);
      const terms = query.split(/\s+/).filter(Boolean);
      const lastTerm = terms[terms.length - 1] || '';
      const previousTerms = terms.slice(0, -1);
      const phraseSuggestions = searchPhrases
        .filter(phrase => normalizeSearchText(phrase).startsWith(query)
          && normalizeSearchText(phrase) !== query)
        .slice(0, 6);
      const wordSuggestions = searchWords
        .filter(word => normalizeSearchText(word).startsWith(lastTerm)
          && normalizeSearchText(word) !== lastTerm)
        .slice(0, 5);
      currentResults = searchProducts
        .map(product => {
          const name = normalizeSearchText(product.name);
          const searchable = normalizeSearchText([
            product.name, product.brand, product.category, product.group, product.description
          ].join(' '));
          const matches = previousTerms.every(term => searchable.includes(term))
            && (!lastTerm || searchable.split(/\s+/).some(word => word.startsWith(lastTerm)));
          const score = !query ? 0 : (name.startsWith(query) ? 4 : name.includes(query) ? 3 : 1);
          return { product, matches, score };
        })
        .filter(item => item.matches)
        .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'tr'))
        .slice(0, 7)
        .map(item => item.product);

      suggestions.replaceChildren();
      activeIndex = -1;
      suggestionActions = [];

      if (!query) {
        closeSuggestions();
        return;
      }

      if (phraseSuggestions.length) {
        const phrasesTitle = document.createElement('div');
        phrasesTitle.className = 'search-suggestions-label';
        phrasesTitle.textContent = 'Arama önerileri';
        suggestions.appendChild(phrasesTitle);
        phraseSuggestions.forEach(phrase => {
          const phraseButton = document.createElement('button');
          phraseButton.type = 'button';
          phraseButton.className = 'search-phrase-suggestion';
          phraseButton.setAttribute('role', 'option');
          phraseButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"../><path d="m16 16 4 4"/></svg><span></span>`;
          phraseButton.querySelector('span').textContent = phrase;
          phraseButton.addEventListener('mousedown', event => event.preventDefault());
          phraseButton.addEventListener('click', () => submitSearch(phrase));
          suggestions.appendChild(phraseButton);
          suggestionActions.push(() => submitSearch(phrase));
        });
      } else if (wordSuggestions.length) {
        const wordsTitle = document.createElement('div');
        wordsTitle.className = 'search-suggestions-label';
        wordsTitle.textContent = 'Kelime önerileri';
        suggestions.appendChild(wordsTitle);
        wordSuggestions.forEach(word => {
          const wordButton = document.createElement('button');
          wordButton.type = 'button';
          wordButton.className = 'search-word-suggestion';
          wordButton.setAttribute('role', 'option');
          wordButton.textContent = word;
          wordButton.addEventListener('mousedown', event => event.preventDefault());
          wordButton.addEventListener('click', () => {
            const prefix = previousTerms.length ? `${previousTerms.join(' ')} ` : '';
            input.value = `${prefix}${word} `;
            input.focus();
            renderSuggestions();
          });
          suggestions.appendChild(wordButton);
          suggestionActions.push(() => {
            const prefix = previousTerms.length ? `${previousTerms.join(' ')} ` : '';
            input.value = `${prefix}${word} `;
            input.focus();
            renderSuggestions();
          });
        });
      }

      if (currentResults.length) {
        const productsTitle = document.createElement('div');
        productsTitle.className = 'search-suggestions-label';
        productsTitle.textContent = 'Ürün önerileri';
        suggestions.appendChild(productsTitle);
      }

      currentResults.forEach((product, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.id = `${listId}-${index}`;
        option.className = 'search-suggestion';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        if (product.image) {
          const image = document.createElement('img');
          image.src = product.image;
          image.alt = '';
          image.loading = 'lazy';
          option.appendChild(image);
        }
        const copy = document.createElement('span');
        copy.className = 'search-suggestion-copy';
        const name = document.createElement('strong');
        name.textContent = product.name;
        const meta = document.createElement('small');
        meta.textContent = [product.category, product.brand].filter(Boolean).join(' · ');
        copy.append(name, meta);
        option.appendChild(copy);
        option.addEventListener('mousedown', event => event.preventDefault());
        option.addEventListener('click', () => submitSearch(product.name));
        suggestions.appendChild(option);
        suggestionActions.push(() => submitSearch(product.name));
      });

      const footer = document.createElement('button');
      footer.type = 'submit';
      footer.className = 'search-suggestion-all';
      footer.textContent = currentResults.length
        ? `"${input.value.trim()}" için tüm sonuçları göster`
        : `"${input.value.trim()}" için ara`;
      suggestions.appendChild(footer);
      suggestions.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', () => {
      if (input.value.trim()) renderSuggestions();
    });
    input.addEventListener('keydown', event => {
      if (suggestions.hidden) return;
      const optionCount = currentResults.length;
      if (event.key === 'ArrowDown' && optionCount) {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % optionCount;
        updateActiveSuggestion();
      } else if (event.key === 'ArrowUp' && optionCount) {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + optionCount) % optionCount;
        updateActiveSuggestion();
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        suggestionActions[activeIndex]?.();
      } else if (event.key === 'Escape') {
        closeSuggestions();
      }
    });
    document.addEventListener('click', event => {
      if (!form.contains(event.target)) closeSuggestions();
    });
  });

  document.querySelectorAll('[data-product-tabs]').forEach(tabs => {
    const buttons = Array.from(tabs.querySelectorAll('[data-product-tab]'));
    const panels = Array.from(tabs.querySelectorAll('[data-product-panel]'));

    const showPanel = name => {
      buttons.forEach(button => {
        const active = button.dataset.productTab === name;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      panels.forEach(panel => {
        panel.hidden = panel.dataset.productPanel !== name;
        panel.classList.toggle('active', !panel.hidden);
      });
    };

    buttons.forEach(button => {
      button.addEventListener('click', () => showPanel(button.dataset.productTab));
    });
  });

  const catalog = document.querySelector('[data-static-catalog]');
  if (catalog) {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get('q') || '').trim().toLocaleLowerCase('tr-TR');
    const group = params.get('grup');
    const brand = group === 'aksesuar' ? '' : (params.get('marka') || '').trim().toLocaleLowerCase('tr-TR');
    const terms = query.split(/\s+/).filter(Boolean);
    const brandFilterGroup = catalog.closest('main')?.querySelector('[data-brand-filter]')?.closest('.toolbar-group');
    if (brandFilterGroup && group === 'aksesuar') {
      brandFilterGroup.hidden = true;
    }
    const filterLinks = catalog.closest('main')?.querySelectorAll('[data-group-filter], [data-brand-filter]') || [];
    filterLinks.forEach(filter => {
      filter.addEventListener('click', event => {
        const target = new URL(filter.href, window.location.href);
        const current = new URLSearchParams(window.location.search);
        const isGroupFilter = filter.hasAttribute('data-group-filter');
        const preservedParam = isGroupFilter ? 'marka' : 'grup';
        const selectingAccessories = isGroupFilter && target.searchParams.get('grup') === 'aksesuar';
        if (selectingAccessories) {
          target.searchParams.delete('marka');
        }
        const accessoryMode = current.get('grup') === 'aksesuar';
        if (accessoryMode && !isGroupFilter) {
          target.searchParams.delete('grup');
        }
        if (!accessoryMode && !target.searchParams.has(preservedParam) && current.has(preservedParam)) {
          target.searchParams.set(preservedParam, current.get(preservedParam));
        }
        if (!target.searchParams.has('q') && current.has('q')) {
          target.searchParams.set('q', current.get('q'));
        }
        event.preventDefault();
        window.location.href = target.toString();
      });
    });
    catalog.closest('main')?.querySelectorAll('[data-group-filter]').forEach(filter => {
      filter.classList.toggle('active', (filter.dataset.groupFilter || '') === (group || ''));
    });
    catalog.querySelectorAll('[data-product-card]').forEach(card => {
      const text = (card.dataset.searchText || '').toLocaleLowerCase('tr-TR');
      const cardBrand = (card.dataset.brand || '').trim().toLocaleLowerCase('tr-TR');
      const cardGroup = (card.dataset.group || '').trim();
      const matchesGroup = !group
        || (group === 'aksesuar' && cardGroup.startsWith('aksesuar-'))
        || cardGroup === group;
      const matchesSearch = terms.every(term => text.includes(term));
      const matchesBrand = !brand || cardBrand === brand;
      card.hidden = !(matchesGroup && matchesSearch && matchesBrand);
    });
    catalog.closest('main')?.querySelectorAll('[data-brand-filter]').forEach(filter => {
      const filterBrand = (filter.dataset.brandFilter || '').trim().toLocaleLowerCase('tr-TR');
      filter.classList.toggle('active', filterBrand === brand);
    });
  }

  const mainImage = document.getElementById('mainImg');
  const thumbnails = Array.from(document.querySelectorAll('[data-gallery-thumb]'));
  const gallery = document.getElementById('galleryMain');
  const previousImage = document.querySelector('[data-gallery-prev]');
  const nextImage = document.querySelector('[data-gallery-next]');
  const galleryCount = document.getElementById('galleryCount');
  if (mainImage && thumbnails.length) {
    let activeImageIndex = 0;
    let touchStartX = null;

    const showImage = index => {
      activeImageIndex = (index + thumbnails.length) % thumbnails.length;
      const thumbnail = thumbnails[activeImageIndex];
      mainImage.src = thumbnail.dataset.image;
      mainImage.alt = thumbnail.dataset.alt || mainImage.alt;
      thumbnails.forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      thumbnail.classList.add('active');
      thumbnail.setAttribute('aria-pressed', 'true');
      if (galleryCount) galleryCount.textContent = `${activeImageIndex + 1} / ${thumbnails.length}`;
    };

    thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener('click', () => {
        showImage(index);
      });
    });

    previousImage?.addEventListener('click', () => showImage(activeImageIndex - 1));
    nextImage?.addEventListener('click', () => showImage(activeImageIndex + 1));

    if (gallery) {
      gallery.addEventListener('touchstart', event => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
      }, { passive: true });
      gallery.addEventListener('touchend', event => {
        const touchEndX = event.changedTouches[0]?.clientX;
        if (touchStartX === null || touchEndX === undefined || Math.abs(touchEndX - touchStartX) < 40) return;
        showImage(activeImageIndex + (touchEndX < touchStartX ? 1 : -1));
        touchStartX = null;
      }, { passive: true });
    }
  }

  const imageInput = document.querySelector('[data-image-input]');
  const preview = document.querySelector('[data-image-preview]');
  if (imageInput && preview) {
    imageInput.addEventListener('change', () => {
      preview.replaceChildren();
      const files = Array.from(imageInput.files || []).slice(0, 12);
      files.forEach(file => {
        const image = document.createElement('img');
        const imageUrl = URL.createObjectURL(file);
        image.src = imageUrl;
        image.alt = `${file.name} önizlemesi`;
        image.addEventListener('load', () => URL.revokeObjectURL(imageUrl), { once: true });
        preview.appendChild(image);
      });
    });
  }

  document.querySelectorAll('form[data-confirm]').forEach(form => {
    form.addEventListener('submit', event => {
      if (!window.confirm(form.dataset.confirm)) event.preventDefault();
    });
  });
});
