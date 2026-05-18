
        const STORAGE_KEY = 'initiativeTrackerTiles';
        const ACTIVE_KEY = 'initiativeTrackerActive';
        const GRID_SIZE = 20; // pixels for snap-to-grid
        let tiles = [];
        let activeTileId = null;
        let draggedElement = null;
        let offsetX = 0;
        let offsetY = 0;
        let lastTapTime = 0;
        const DOUBLE_TAP_THRESHOLD = 300;
        let lastLoadedCollection = null; // Track the last loaded collection name

        // Load tiles from localStorage on page load
        function loadTiles() {
            const stored = localStorage.getItem(STORAGE_KEY);
            tiles = stored ? JSON.parse(stored) : [];
            // ensure each tile has statuses array
            tiles.forEach(t => {
                if (!Array.isArray(t.statuses)) t.statuses = [];
            });
            activeTileId = localStorage.getItem(ACTIVE_KEY);
            renderTiles();
        }

        // Save tiles to localStorage
        function saveTiles() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tiles));
        }

        // Set active tile
        function setActiveTile(id) {
            activeTileId = id === activeTileId ? null : id;
            localStorage.setItem(ACTIVE_KEY, activeTileId);
            renderTiles();
        }

        // Add a new tile
        function addTile() {
            const newTile = {
                id: Date.now(),
                name: 'New Initiative',
                order: tiles.length,
                statuses: []
            };
            tiles.push(newTile);
            if (tiles.length === 1) {
                lastLoadedCollection = null; // Reset if this is the first tile (new content)
            }
            saveTiles();
            renderTiles();
            // Auto-focus the new tile for editing
            setTimeout(() => {
                const newElement = document.querySelector(`[data-id="${newTile.id}"]`);
                if (newElement) {
                    const nameElement = newElement.querySelector('.tile-name');
                    editTileName(newTile.id);
                }
            }, 0);
        }

        // Delete a tile
        function deleteTile(id) {
            tiles = tiles.filter(t => t.id !== id);
            saveTiles();
            renderTiles();
        }

        // Clear all tiles
        function clearAllTiles() {
            if (tiles.length === 0) return;
            if (confirm('Are you sure you want to clear all tiles?')) {
                tiles = [];
                lastLoadedCollection = null; // Reset loaded collection since we're starting fresh
                saveTiles();
                renderTiles();
            }
        }

        // Save collection
        async function saveCollection() {
            if (tiles.length === 0) {
                alert('No tiles to save!');
                return;
            }

            let collectionName = null;

            // If we loaded a collection and haven't saved yet, offer to overwrite it
            if (lastLoadedCollection && !confirm('Save as a new collection? (Cancel to overwrite the loaded collection)')) {
                collectionName = lastLoadedCollection;
                if (!confirm(`Overwrite "${collectionName}"?`)) {
                    return;
                }
            } else {
                // Prompt for new collection name
                collectionName = prompt('Enter collection name:');
                if (!collectionName || !collectionName.trim()) return;
                collectionName = collectionName.trim();

                // Check if collection already exists
                const exists = await collectionExists(collectionName);
                if (exists && !confirm(`Collection "${collectionName}" already exists. Overwrite it?`)) {
                    return;
                }
            }

            try {
                const response = await fetch('/api/collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: collectionName, tiles })
                });
                const result = await response.json();
                if (result.success) {
                    alert('Collection saved successfully!');
                    lastLoadedCollection = collectionName; // Update last loaded collection
                    populateDropdowns(); // Refresh dropdowns
                } else {
                    alert('Failed to save collection: ' + result.error);
                }
            } catch (error) {
                alert('Error saving collection: ' + error.message);
            }
        }

        // Check if a collection exists
        async function collectionExists(name) {
            try {
                const response = await fetch('/api/collections');
                const collections = await response.json();
                return collections.includes(name);
            } catch (error) {
                console.error('Error checking collection existence:', error);
                return false;
            }
        }

        // Load collection
        async function loadCollection(collectionName) {
            try {
                const loadResponse = await fetch(`/api/collections/${encodeURIComponent(collectionName)}`);
                if (loadResponse.status === 404) {
                    alert('Collection not found!');
                    return;
                }
                const loadedTiles = await loadResponse.json();
                tiles = loadedTiles;
                activeTileId = null;
                saveTiles();
                renderTiles();
                lastLoadedCollection = collectionName; // Track the loaded collection
                alert('Collection loaded successfully!');
                toggleDropdown('loadDropdown'); // Close dropdown
            } catch (error) {
                alert('Error loading collection: ' + error.message);
            }
        }

        // Delete collection
        async function deleteCollection(collectionName) {
            if (!confirm(`Are you sure you want to delete the collection "${collectionName}"?`)) return;

            try {
                const deleteResponse = await fetch(`/api/collections/${encodeURIComponent(collectionName)}`, {
                    method: 'DELETE'
                });
                const result = await deleteResponse.json();
                if (result.success) {
                    alert('Collection deleted successfully!');
                    toggleDropdown('deleteDropdown'); // Close dropdown
                    populateDropdowns(); // Refresh dropdowns
                } else {
                    alert('Failed to delete collection: ' + result.error);
                }
            } catch (error) {
                alert('Error deleting collection: ' + error.message);
            }
        }

        // Rename collection
        async function renameCollection(oldName) {
            const newName = prompt(`Enter new name for "${oldName}":`);
            if (!newName || !newName.trim()) return;

            try {
                const renameResponse = await fetch(`/api/collections/${encodeURIComponent(oldName)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newName: newName.trim() })
                });
                const result = await renameResponse.json();
                if (result.success) {
                    alert('Collection renamed successfully!');
                    toggleDropdown('renameDropdown'); // Close dropdown
                    populateDropdowns(); // Refresh dropdowns
                } else {
                    alert('Failed to rename collection: ' + result.error);
                }
            } catch (error) {
                alert('Error renaming collection: ' + error.message);
            }
        }

        // Toggle dropdown visibility
        function toggleDropdown(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            const isVisible = dropdown.classList.contains('show');

            // Close all dropdowns first
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

            // Open the clicked dropdown if it wasn't already open
            if (!isVisible) {
                dropdown.classList.add('show');
                populateDropdowns(); // Refresh content when opening
            }
        }

        // Populate all dropdowns with collections
        async function populateDropdowns() {
            try {
                const response = await fetch('/api/collections');
                const collections = await response.json();

                // Populate load dropdown
                const loadDropdown = document.getElementById('loadDropdown');
                loadDropdown.innerHTML = '';
                if (collections.length === 0) {
                    loadDropdown.innerHTML = '<div class="dropdown-item empty">No collections found</div>';
                } else {
                    collections.forEach(name => {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.textContent = name;
                        item.onclick = () => loadCollection(name);
                        loadDropdown.appendChild(item);
                    });
                }

                // Populate rename dropdown
                const renameDropdown = document.getElementById('renameDropdown');
                renameDropdown.innerHTML = '';
                if (collections.length === 0) {
                    renameDropdown.innerHTML = '<div class="dropdown-item empty">No collections found</div>';
                } else {
                    collections.forEach(name => {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.textContent = name;
                        item.onclick = () => renameCollection(name);
                        renameDropdown.appendChild(item);
                    });
                }

                // Populate delete dropdown
                const deleteDropdown = document.getElementById('deleteDropdown');
                deleteDropdown.innerHTML = '';
                if (collections.length === 0) {
                    deleteDropdown.innerHTML = '<div class="dropdown-item empty">No collections found</div>';
                } else {
                    collections.forEach(name => {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.textContent = name;
                        item.onclick = () => deleteCollection(name);
                        deleteDropdown.appendChild(item);
                    });
                }
            } catch (error) {
                console.error('Error populating dropdowns:', error);
            }
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
            }
        });

        // Edit tile name
        function editTileName(id) {
            const tile = tiles.find(t => t.id === id);
            const element = document.querySelector(`[data-id="${id}"]`);
            const nameElement = element.querySelector('.tile-name');

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tile-name-input';
            input.value = tile.name;

            nameElement.replaceWith(input);
            input.focus();
            input.select();

            const saveName = () => {
                const newName = input.value.trim() || 'New Initiative';
                tile.name = newName;
                saveTiles();
                renderTiles();
            };

            input.addEventListener('blur', saveName);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveName();
            });
        }

        // Render all tiles
        function renderTiles() {
            const container = document.getElementById('gridContainer');
            const emptyState = document.getElementById('emptyState');

            if (tiles.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';
            container.innerHTML = tiles.map((tile, index) => `
                <div class="tile ${activeTileId == tile.id ? 'active' : ''}" data-id="${tile.id}" draggable="true">
                    <div class="tile-content">
                        <div class="tile-name" onclick="editTileName(${tile.id})">${escapeHtml(tile.name)}</div>
                        <div class="tile-statuses" id="statuses-${tile.id}">
                            ${tile.statuses && tile.statuses.length ? tile.statuses.map(status => `
                                <div class="status-badge${status.expiresAt ? ' timer' : ''}" data-status-id="${status.id}">
                                    <span class="status-name" onclick="editStatusName(${tile.id}, ${status.id})">${escapeHtml(status.name)}</span>
                                    ${status.expiresAt ? `<span class="status-timer">${formatRemaining(status.expiresAt - Date.now())}</span>` : ``}
                                    <button class="status-remove" onclick="removeStatus(${tile.id}, ${status.id})">×</button>
                                </div>
                            `).join('') : ``}
                        </div>
                        <button class="status-add" onclick="addStatus(${tile.id})">+ Status</button>
                    </div>
                    <div class="tile-number">#${index + 1}</div>
                    <button class="tile-delete" onclick="deleteTile(${tile.id})">×</button>
                </div>
            `).join('');

            // Add event listeners to tiles
            document.querySelectorAll('.tile').forEach(tileElement => {
                tileElement.addEventListener('dragstart', handleDragStart);
                tileElement.addEventListener('dragend', handleDragEnd);
                tileElement.addEventListener('dragover', handleDragOver);
                tileElement.addEventListener('drop', handleDrop);
                tileElement.addEventListener('dragenter', handleDragEnter);
                tileElement.addEventListener('dragleave', handleDragLeave);
                tileElement.addEventListener('dblclick', handleDoubleTap);
                tileElement.addEventListener('touchend', handleTouchEnd);
            });
        }

        // Double-tap and double-click handlers
        function handleDoubleTap(e) {
            if (e.target.classList.contains('tile-delete')) return;
            const tileId = parseInt(this.dataset.id);
            setActiveTile(tileId);
        }

        function handleTouchEnd(e) {
            const now = Date.now();
            if (now - lastTapTime < DOUBLE_TAP_THRESHOLD) {
                if (e.target.classList.contains('tile-delete') || e.target.classList.contains('tile-name')) return;
                const tileId = parseInt(this.dataset.id);
                setActiveTile(tileId);
            }
            lastTapTime = now;
        }

        // Drag and drop handlers
        function handleDragStart(e) {
            draggedElement = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        }

        function handleDragEnd(e) {
            if (draggedElement) draggedElement.classList.remove('dragging');
            document.querySelectorAll('.tile').forEach(t => t.style.opacity = '');
            draggedElement = null;
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
        }

        function handleDragEnter(e) {
            if (this !== draggedElement && this.classList.contains('tile')) {
                this.style.opacity = '0.5';
            }
        }

        function handleDragLeave(e) {
            if (this !== draggedElement) {
                this.style.opacity = '';
            }
        }

        function handleDrop(e) {
            e.preventDefault();
            e.stopPropagation();

            if (this !== draggedElement && this.classList.contains('tile')) {
                // Get the ids
                const draggedId = parseInt(draggedElement.dataset.id);
                const targetId = parseInt(this.dataset.id);

                // Find the indices
                const draggedIndex = tiles.findIndex(t => t.id === draggedId);
                const targetIndex = tiles.findIndex(t => t.id === targetId);

                // Swap the tiles
                if (draggedIndex !== -1 && targetIndex !== -1) {
                    [tiles[draggedIndex], tiles[targetIndex]] = [tiles[targetIndex], tiles[draggedIndex]];
                    saveTiles();
                    renderTiles();
                }
            }

            return false;
        }

        // Utility function to escape HTML
        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        // helper to format remaining milliseconds as mm:ss
        function formatRemaining(ms) {
            if (ms <= 0) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        // add a status to a tile (limit 5)
        function addStatus(tileId) {
            const tile = tiles.find(t => t.id === tileId);
            if (!tile) return;
            if (tile.statuses.length >= 5) {
                alert('Maximum of 5 statuses allowed');
                return;
            }
            const name = prompt('Enter status name:');
            if (!name) return;
            const isTimer = confirm('Is this a timer? OK = yes, Cancel = no');
            const status = { id: Date.now(), name: name };
            if (isTimer) {
                const minutes = prompt('Duration in minutes (fractional allowed):');
                const num = parseFloat(minutes);
                if (!isNaN(num) && num > 0) {
                    status.expiresAt = Date.now() + num * 60 * 1000;
                }
            }
            tile.statuses.push(status);
            saveTiles();
            renderTiles();
        }

        function removeStatus(tileId, statusId) {
            const tile = tiles.find(t => t.id === tileId);
            if (!tile) return;
            tile.statuses = tile.statuses.filter(s => s.id !== statusId);
            saveTiles();
            renderTiles();
        }

        function updateTimers() {
            let changed = false;
            tiles.forEach(tile => {
                tile.statuses = tile.statuses.filter(s => {
                    if (s.expiresAt) {
                        if (Date.now() >= s.expiresAt) {
                            changed = true;
                            return false; // remove expired
                        }
                    }
                    return true;
                });
            });
            if (changed) saveTiles();

            document.querySelectorAll('.status-badge').forEach(badge => {
                const statusId = parseInt(badge.dataset.statusId);
                const hex = parseInt(badge.closest('.tile').dataset.id);
                const tile = tiles.find(t => t.id === hex);
                if (!tile) return;
                const status = tile.statuses.find(s => s.id === statusId);
                const timerSpan = badge.querySelector('.status-timer');
                if (status && status.expiresAt && timerSpan) {
                    timerSpan.textContent = formatRemaining(status.expiresAt - Date.now());
                }
            });
            // re-render if statuses removed
            if (changed) renderTiles();
        }

        function editStatusName(tileId, statusId) {
            const tile = tiles.find(t => t.id === tileId);
            if (!tile) return;
            const status = tile.statuses.find(s => s.id === statusId);
            if (!status) return;
            const newName = prompt('Status name:', status.name);
            if (newName && newName.trim() !== '') {
                status.name = newName.trim();
                saveTiles();
                renderTiles();
            }
        }

        // Initialize on page load
        window.addEventListener('DOMContentLoaded', () => {
            loadTiles();
            // tick every second for timers
            setInterval(updateTimers, 1000);
        });
    