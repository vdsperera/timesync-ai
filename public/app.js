document.addEventListener('DOMContentLoaded', async () => {
    const inputSection = document.getElementById('inputSection');
    const reviewSection = document.getElementById('reviewSection');
    const logInput = document.getElementById('logInput');
    const processBtn = document.getElementById('processBtn');
    const processBtnText = document.getElementById('processBtnText');
    const inputError = document.getElementById('inputError');
    const reviewTableBody = document.getElementById('reviewTableBody');
    const backBtn = document.getElementById('backBtn');
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    // Global state
    let validCategories = { mainTypes: [], subTypes: [] };
    let currentResults = [];
    
    // Init auto-cleanup toggle
    const autoCleanupToggle = document.getElementById('autoCleanupToggle');
    if (autoCleanupToggle) {
        const storedPref = localStorage.getItem('timesync_auto_cleanup');
        if (storedPref !== null) {
            autoCleanupToggle.checked = storedPref === 'true';
        }
        autoCleanupToggle.addEventListener('change', (e) => {
            localStorage.setItem('timesync_auto_cleanup', e.target.checked);
        });
    }

    // 1. Fetch categories on load
    try {
        const res = await fetch('/api/categories');
        if (res.ok) {
            validCategories = await res.json();
            console.log("Categories loaded:", validCategories);
            
            // Check for drafts
            const draft = localStorage.getItem('timesync_draft');
            if (draft) {
                try {
                    currentResults = JSON.parse(draft);
                    if (currentResults.length > 0) {
                        renderTable(currentResults);
                        inputSection.classList.add('hidden');
                        reviewSection.classList.remove('hidden');
                    }
                } catch (e) {
                    localStorage.removeItem('timesync_draft');
                }
            }
            
            renderDraftLibrary();
        } else {
            console.error("Failed to load categories.");
            inputError.textContent = "Warning: Failed to load Notion categories. AI categorization may be inaccurate.";
            inputError.classList.remove('hidden');
            renderDraftLibrary();
        }
    } catch (err) {
        console.error("Network error loading categories:", err);
        renderDraftLibrary();
    }

    // 2. Process logs
    processBtn.addEventListener('click', async () => {
        const text = logInput.value.trim();
        
        if (!text) {
            inputError.textContent = "Please provide log entries to process.";
            inputError.classList.remove('hidden');
            logInput.style.borderColor = 'var(--error)';
            return;
        }

        inputError.classList.add('hidden');
        logInput.style.borderColor = 'var(--border)';

        const entries = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Set loading state
        processBtn.disabled = true;
        processBtnText.textContent = "Processing with AI...";

        try {
            const res = await fetch('/api/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries })
            });

            if (!res.ok) {
                throw new Error("API returned an error");
            }

            const data = await res.json();
            currentResults = data.results;
            
            saveDraft();
            renderTable(currentResults);
            
            // Switch view
            inputSection.classList.add('hidden');
            reviewSection.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            inputError.textContent = "An error occurred while processing logs. Please try again.";
            inputError.classList.remove('hidden');
        } finally {
            processBtn.disabled = false;
            processBtnText.textContent = "Process Logs with AI";
        }
    });

    // 3. Render table
    function saveDraft() {
        if (currentResults.length > 0) {
            localStorage.setItem('timesync_draft', JSON.stringify(currentResults));
        } else {
            localStorage.removeItem('timesync_draft');
        }
    }

    function renderDraftLibrary() {
        const list = document.getElementById('draftList');
        if (!list) return;
        const libraryJson = localStorage.getItem('timesync_library');
        const library = libraryJson ? JSON.parse(libraryJson) : {};
        
        list.innerHTML = '';
        const keys = Object.keys(library).sort().reverse();
        if (keys.length === 0) {
            list.innerHTML = '<li class="hint">No saved drafts found.</li>';
            return;
        }

        keys.forEach(date => {
            const entries = library[date];
            const li = document.createElement('li');
            li.style = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);";
            li.innerHTML = `
                <span style="color: var(--text-primary);">Draft: ${escapeHtml(date)} (${entries.length} entries)</span>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="secondary-btn load-lib-btn" data-date="${escapeHtml(date)}" style="padding: 2px 8px; font-size: 0.8rem;">Load</button>
                    <button class="delete-lib-btn" aria-label="Delete draft" data-date="${escapeHtml(date)}" style="background: transparent; border: none; color: var(--error); cursor: pointer; padding: 2px 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });

        document.querySelectorAll('.load-lib-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const date = e.currentTarget.getAttribute('data-date');
                currentResults = library[date];
                saveDraft();
                renderTable(currentResults);
                inputSection.classList.add('hidden');
                reviewSection.classList.remove('hidden');
            });
        });
        document.querySelectorAll('.delete-lib-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const date = e.currentTarget.getAttribute('data-date');
                delete library[date];
                localStorage.setItem('timesync_library', JSON.stringify(library));
                renderDraftLibrary();
            });
        });
    }

    function createOptions(options, selectedValue) {
        return options.map(opt => `<option value="${escapeHtml(opt)}" ${opt === selectedValue ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
    }

    function renderTable(results) {
        reviewTableBody.innerHTML = '';
        results.forEach((result, idx) => {
            const tr = document.createElement('tr');
            if (result.isAiFailure || !result.date) {
                tr.classList.add('error-row');
            }

            const relevantSubTypes = result.mainType && validCategories.subTypeMapping && validCategories.subTypeMapping[result.mainType] 
                ? validCategories.subTypeMapping[result.mainType] 
                : validCategories.subTypes;

            tr.innerHTML = `
                <td><code>${escapeHtml(result.originalText)}</code></td>
                <td>
                    <input type="date" aria-label="Edit date" class="edit-date" data-idx="${idx}" value="${escapeHtml(result.date || '')}" style="width: 120px; background: transparent; border: 1px solid var(--border); color: var(--text-primary); padding: 4px 8px; border-radius: 4px;">
                </td>
                <td>
                    <input type="text" aria-label="Edit duration" class="edit-duration" data-idx="${idx}" value="${escapeHtml(result.duration || '')}" placeholder="0.0H" style="width: 70px; background: transparent; border: 1px solid var(--border); color: var(--text-primary); padding: 4px 8px; border-radius: 4px;">
                </td>
                <td>
                    <select aria-label="Edit main type" class="edit-main-type" data-idx="${idx}" style="background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); padding: 4px 8px; border-radius: 4px;">
                        <option value="">-- Select --</option>
                        ${createOptions(validCategories.mainTypes, result.mainType)}
                    </select>
                </td>
                <td>
                    <select aria-label="Edit sub type" class="edit-sub-type" data-idx="${idx}" style="background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); padding: 4px 8px; border-radius: 4px;">
                        <option value="">-- Select --</option>
                        ${createOptions(relevantSubTypes, result.subType)}
                    </select>
                </td>
                <td class="status-cell">
                    ${(result.isAiFailure || !result.date)
                        ? '<span class="status-badge error">Review Required</span>' 
                        : '<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Ready</span>'}
                </td>
                <td>
                    <button aria-label="Delete entry" class="delete-btn" data-idx="${idx}" style="background: transparent; border: none; color: var(--error); cursor: pointer; padding: 4px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            `;
            reviewTableBody.appendChild(tr);
        });

        // Add event listeners to update state and clear error styling
        const clearErrorState = (e) => {
            const tr = e.target.closest('tr');
            const idx = e.target.getAttribute('data-idx');
            const r = currentResults[idx];
            if (r.date && r.duration && r.mainType && r.subType) {
                if (tr.classList.contains('error-row')) {
                    tr.classList.remove('error-row');
                    tr.querySelector('.status-cell').innerHTML = '<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Ready</span>';
                    r.isAiFailure = false;
                }
            } else {
                tr.classList.add('error-row');
                tr.querySelector('.status-cell').innerHTML = '<span class="status-badge error">Review Required</span>';
            }
        };

        document.querySelectorAll('.edit-date').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].date = e.target.value;
                saveDraft();
                clearErrorState(e);
            });
        });

        document.querySelectorAll('.edit-duration').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].duration = e.target.value;
                saveDraft();
                clearErrorState(e);
            });
        });
        document.querySelectorAll('.edit-main-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].mainType = e.target.value;
                
                // Update sub type dropdown dynamically
                const subTypeSelect = e.target.closest('tr').querySelector('.edit-sub-type');
                const relevantSubTypes = currentResults[idx].mainType && validCategories.subTypeMapping && validCategories.subTypeMapping[currentResults[idx].mainType] 
                    ? validCategories.subTypeMapping[currentResults[idx].mainType] 
                    : validCategories.subTypes;
                
                if (!relevantSubTypes.includes(currentResults[idx].subType)) {
                    currentResults[idx].subType = "";
                }
                subTypeSelect.innerHTML = '<option value="">-- Select --</option>' + createOptions(relevantSubTypes, currentResults[idx].subType);
                
                saveDraft();
                clearErrorState(e);
            });
        });
        document.querySelectorAll('.edit-sub-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].subType = e.target.value;
                saveDraft();
                clearErrorState(e);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.getAttribute('data-idx');
                currentResults.splice(idx, 1);
                saveDraft();
                renderTable(currentResults);
                
                if (currentResults.length === 0) {
                    reviewSection.classList.add('hidden');
                    inputSection.classList.remove('hidden');
                }
            });
        });
    }

    // 4. Draft Library & Sync Logic
    document.getElementById('saveDraftBtn')?.addEventListener('click', () => {
        if (currentResults.length === 0) return;
        
        const libraryJson = localStorage.getItem('timesync_library');
        const library = libraryJson ? JSON.parse(libraryJson) : {};
        
        const date = currentResults[0].date || new Date().toISOString().split('T')[0];
        
        library[date] = currentResults;
        localStorage.setItem('timesync_library', JSON.stringify(library));
        
        renderDraftLibrary();
        
        const btn = document.getElementById('saveDraftBtn');
        const originalText = btn.textContent;
        btn.textContent = "Saved!";
        btn.style.color = "#10b981";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = "";
        }, 2000);
    });

    syncBtn.addEventListener('click', async () => {
        if (currentResults.length === 0) return;

        let hasErrors = currentResults.some(r => r.isAiFailure || !r.date);
        if (hasErrors) {
            alert("Please fix the highlighted rows (missing dates or categories) before syncing.");
            return;
        }

        syncBtn.disabled = true;
        syncStatus.classList.remove('hidden');
        syncStatus.classList.remove('error');
        syncStatus.style.background = 'rgba(99, 102, 241, 0.1)';
        syncStatus.style.color = 'var(--accent)';
        syncStatus.textContent = "Syncing to Notion...";

        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: currentResults })
            });

            const data = await res.json();
            
            if (res.ok) {
                if (data.failedEntries && data.failedEntries.length > 0) {
                    syncStatus.textContent = `Synced ${data.successCount}, Failed ${data.failedEntries.length}`;
                    syncStatus.classList.add('error');
                    
                    // Retain only failed entries in the queue
                    currentResults = data.failedEntries.map(f => f.entry);
                    renderTable(currentResults);
                    
                    // Mark them as errors in UI
                    const trs = reviewTableBody.querySelectorAll('tr');
                    trs.forEach((tr, i) => {
                        tr.classList.add('error-row');
                        tr.querySelector('.status-cell').innerHTML = `<span class="status-badge error" title="${escapeHtml(data.failedEntries[i].error)}">Sync Failed</span>`;
                    });
                } else {
                    syncStatus.textContent = `Successfully synced ${data.successCount} entries!`;
                    syncStatus.style.color = '#10b981';
                    syncStatus.style.background = 'rgba(16, 185, 129, 0.1)';
                    
                    if (currentResults.length > 0 && autoCleanupToggle && autoCleanupToggle.checked) {
                        const date = currentResults[0].date || new Date().toISOString().split('T')[0];
                        const libraryJson = localStorage.getItem('timesync_library');
                        if (libraryJson) {
                            const library = JSON.parse(libraryJson);
                            if (library[date]) {
                                delete library[date];
                                localStorage.setItem('timesync_library', JSON.stringify(library));
                                renderDraftLibrary();
                            }
                        }
                    }

                    currentResults = [];
                    saveDraft();
                    renderTable(currentResults);
                    
                    setTimeout(() => {
                        syncStatus.classList.add('hidden');
                        logInput.value = '';
                        reviewSection.classList.add('hidden');
                        inputSection.classList.remove('hidden');
                    }, 2000);
                }
            } else {
                throw new Error(data.error || "Sync failed");
            }
        } catch (err) {
            console.error("Sync error:", err);
            syncStatus.textContent = "Fatal sync error. Check console.";
            syncStatus.classList.add('error');
        } finally {
            syncBtn.disabled = false;
        }
    });

    backBtn.addEventListener('click', () => {
        reviewSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
    });

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
