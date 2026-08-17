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

    // 1. Fetch categories on load
    try {
        const res = await fetch('/api/categories');
        if (res.ok) {
            validCategories = await res.json();
            console.log("Categories loaded:", validCategories);
        } else {
            console.error("Failed to load categories.");
            inputError.textContent = "Warning: Failed to load Notion categories. AI categorization may be inaccurate.";
            inputError.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Network error loading categories:", err);
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
    function createOptions(options, selectedValue) {
        return options.map(opt => `<option value="${escapeHtml(opt)}" ${opt === selectedValue ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
    }

    function renderTable(results) {
        reviewTableBody.innerHTML = '';
        results.forEach((result, idx) => {
            const tr = document.createElement('tr');
            if (result.isAiFailure) {
                tr.classList.add('error-row');
            }

            tr.innerHTML = `
                <td><code>${escapeHtml(result.originalText)}</code></td>
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
                        ${createOptions(validCategories.subTypes, result.subType)}
                    </select>
                </td>
                <td class="status-cell">
                    ${result.isAiFailure 
                        ? '<span class="status-badge error">Review Required</span>' 
                        : '<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Ready</span>'}
                </td>
            `;
            reviewTableBody.appendChild(tr);
        });

        // Add event listeners to update state and clear error styling
        const clearErrorState = (e) => {
            const tr = e.target.closest('tr');
            if (tr.classList.contains('error-row')) {
                tr.classList.remove('error-row');
                tr.querySelector('.status-cell').innerHTML = '<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Ready</span>';
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].isAiFailure = false;
            }
        };

        document.querySelectorAll('.edit-duration').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].duration = e.target.value;
                clearErrorState(e);
            });
        });
        document.querySelectorAll('.edit-main-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].mainType = e.target.value;
                clearErrorState(e);
            });
        });
        document.querySelectorAll('.edit-sub-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-idx');
                currentResults[idx].subType = e.target.value;
                clearErrorState(e);
            });
        });
    }

    // 4. Sync Logic
    syncBtn.addEventListener('click', async () => {
        if (currentResults.length === 0) return;

        // Prevent syncing if there are still unresolved AI failures
        const hasFailures = currentResults.some(r => r.isAiFailure);
        if (hasFailures) {
            alert("Please resolve all items marked 'Review Required' before syncing.");
            return;
        }

        syncBtn.disabled = true;
        syncStatus.classList.remove('hidden');
        syncStatus.classList.remove('error');
        syncStatus.style.background = 'rgba(99, 102, 241, 0.1)';
        syncStatus.style.color = 'var(--accent)';
        syncStatus.textContent = "Syncing to Notion...";
        
        // Add current date if needed
        const today = new Date().toISOString().split('T')[0];
        const payload = currentResults.map(r => ({ ...r, date: today }));

        try {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: payload })
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
                    currentResults = [];
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
