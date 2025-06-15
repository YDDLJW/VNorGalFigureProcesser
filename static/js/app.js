// static/js/app.js

// ——— 全局状态 ———
let folderFiles = [];
let selectedThumbIndex = null;

let layers = [];
let activeLayer = null;

let folders = [];
let selectedFolderIndex = null;
let selectedFolderThumbIndex = null;

let isDraggingLayer = false;
let isPanning = false;
let dragOffset = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };

let scale = 1;
let origin = { x: 0, y: 0 };

let cancelBatch = false;
const historyStack = [];
const THUMB_SIZE = 100;

// ——— DOM 引用 ———
const batchModal           = document.getElementById('batch-modal');
const modalProgress        = document.getElementById('batch-modal-progress');
const modalText            = document.getElementById('batch-modal-text');
const cancelBtn            = document.getElementById('batch-cancel');

const btnSelectFolder      = document.getElementById('btn-select-folder');
const btnDeletePreview     = document.getElementById('btn-delete-preview');
const thumbContainer       = document.getElementById('thumb-container');
const btnAddImage          = document.getElementById('btn-add-image');
const btnNewFolder         = document.getElementById('btn-new-folder');
const btnAddToFolder       = document.getElementById('btn-add-to-folder');
const btnSystemAddToFolder = document.getElementById('btn-system-add-to-folder');
const folderList           = document.getElementById('folder-list');
const folderThumbContainer = document.getElementById('folder-thumb-container');

const btnDeleteLayer       = document.getElementById('btn-delete-layer');
const btnDeleteFolder      = document.getElementById('btn-delete-folder');
const btnDeleteFolderImage = document.getElementById('btn-delete-folder-image');
const btnSaveImage         = document.getElementById('btn-save-image');
const btnSaveCoords        = document.getElementById('btn-save-coords');
const btnJump              = document.getElementById('btn-jump');
const btnBatchComposite    = document.getElementById('btn-batch-composite');
const inputCoords          = document.getElementById('input-coords');
const coordsDisplay        = document.getElementById('current-coords');

const canvas               = document.getElementById('main-canvas');
const ctx                  = canvas.getContext('2d');
const layerList            = document.getElementById('layer-list');

// ——— 保存历史快照 ———
function saveHistory() {
  historyStack.push({
    layers: layers.map(l => ({
      fileName: l.fileName,
      x: l.x, y: l.y,
      name: l.name,
      selected: l.selected
    })),
    folders: folders.map(f => ({
      name: f.name,
      fileNames: f.files.map(file => file.name)
    })),
    selectedThumbIndex,
    selectedFolderIndex,
    selectedFolderThumbIndex
  });
  if (historyStack.length > 50) historyStack.shift();
}

// ——— 缩略图容器样式 ———
[thumbContainer, folderThumbContainer].forEach(c => {
  c.style.overflowY = 'auto';
  c.style.display   = 'flex';
  c.style.flexWrap  = 'wrap';
  c.style.gap       = '4px';
  c.addEventListener('wheel', e => e.stopPropagation());
});

// ——— 渲染缩略图 ———
function highlightThumbnails() {
  thumbContainer.querySelectorAll('img').forEach((img, idx) => {
    img.style.border = idx === selectedThumbIndex
      ? '2px solid #28a745'
      : '1px solid transparent';
    img.classList.toggle('selected', idx === selectedThumbIndex);
  });
}
function renderThumbnails() {
  thumbContainer.innerHTML = '';
  folderFiles.forEach((file, idx) => {
    const img = document.createElement('img');
    img.src      = URL.createObjectURL(file);
    img.onload   = () => URL.revokeObjectURL(img.src);
    img.style.width     = img.style.height = `${THUMB_SIZE}px`;
    img.style.objectFit = 'contain';
    img.style.cursor    = 'pointer';
    img.addEventListener('click', () => {
      selectedThumbIndex = idx;
      highlightThumbnails();
      btnAddImage.disabled = false;
      btnDeletePreview.disabled = false;
    });
    thumbContainer.appendChild(img);
  });
  highlightThumbnails();
  btnAddImage.disabled = (selectedThumbIndex === null);
  btnDeletePreview.disabled = (selectedThumbIndex === null);
}

// ——— 从预览中删除选中图片 ———
btnDeletePreview.addEventListener('click', () => {
  if (selectedThumbIndex === null) return alert('请先选择要删除的预览图片');
  folderFiles.splice(selectedThumbIndex, 1);
  selectedThumbIndex = null;
  renderThumbnails();
});

// ——— 选择图片文件（追加模式） ———
btnSelectFolder.addEventListener('click', () => {
  const inp = document.createElement('input');
  inp.type     = 'file';
  inp.multiple = true;
  inp.accept   = 'image/*';
  inp.onchange = e => {
    folderFiles = folderFiles.concat(Array.from(e.target.files));
    selectedThumbIndex = null;
    renderThumbnails();
  };
  inp.click();
});

// ——— 渲染文件夹缩略图 ———
function renderFolderThumbnails() {
  folderThumbContainer.innerHTML = '';
  if (selectedFolderIndex === null) return;
  folders[selectedFolderIndex].files.forEach((file, idx) => {
    const img = document.createElement('img');
    img.src      = URL.createObjectURL(file);
    img.onload   = () => URL.revokeObjectURL(img.src);
    img.style.width     = img.style.height = `${THUMB_SIZE}px`;
    img.style.objectFit = 'contain';
    img.style.cursor    = 'pointer';
    img.style.border    = idx === selectedFolderThumbIndex
      ? '2px solid #28a745'
      : '1px solid transparent';
    img.addEventListener('click', () => {
      selectedFolderThumbIndex = idx;
      renderFolderThumbnails();
    });
    folderThumbContainer.appendChild(img);
  });
}

// ——— 渲染列表 ———
function renderFolderList() {
  folderList.innerHTML = '';
  folders.forEach((f, idx) => {
    const li = document.createElement('li');
    li.textContent = f.name;
    li.draggable   = true;
    li.style.border = idx === selectedFolderIndex
      ? '2px solid #28a745'
      : '1px solid transparent';
    li.addEventListener('click', () => {
      selectedFolderIndex = idx;
      selectedFolderThumbIndex = null;
      renderFolderList();
      renderFolderThumbnails();
    });
    li.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', idx));
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => {
      saveHistory();
      const from = +e.dataTransfer.getData('text/plain');
      const moved = folders.splice(from, 1)[0];
      folders.splice(idx, 0, moved);
      folders.forEach((f2, j) => f2.name = `Folder_${j}`);
      selectedFolderIndex = idx;
      renderFolderList();
      renderFolderThumbnails();
    });
    folderList.appendChild(li);
  });
}
function renderLayerList() {
  layerList.innerHTML = '';
  layers.forEach((l, idx) => {
    const li = document.createElement('li');
    li.textContent  = l.name;
    li.draggable    = true;
    li.style.border = l.selected
      ? '2px solid #28a745'
      : '1px solid transparent';
    li.addEventListener('click', () => {
      layers.forEach(x => x.selected = false);
      l.selected = true;
      activeLayer = l;
      renderLayerList();
      drawCanvas();
    });
    li.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', idx));
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => {
      saveHistory();
      const from = +e.dataTransfer.getData('text/plain');
      const moved = layers.splice(from, 1)[0];
      layers.splice(idx, 0, moved);
      layers.forEach((l2, j) => l2.name = j.toString());
      renderLayerList();
      drawCanvas();
    });
    layerList.appendChild(li);
  });
}

// ——— 选择并校验坐标 JSON ———
async function selectCoordsJson() {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type   = 'file';
    inp.accept = '.json';
    inp.onchange = async e => {
      try {
        const text = await e.target.files[0].text();
        const obj  = JSON.parse(text);
        Object.values(obj).forEach(c => {
          if (typeof c.x !== 'number' || typeof c.y !== 'number') throw new Error();
        });
        resolve(obj);
      } catch {
        alert('无效的坐标 JSON，需为 {"0":{x:..,y:..},...}');
        resolve(null);
      }
    };
    inp.click();
  });
}

// ——— 批量合成 ———
async function compositeAll(coordsMap, dirHandle) {
  const counts = folders.map(f => f.files.length);
  const combos = [];
  (function dfs(depth, path) {
    if (depth === counts.length) {
      combos.push([...path]);
      return;
    }
    for (let i = 0; i < counts[depth]; i++) {
      path.push(i);
      dfs(depth+1, path);
      path.pop();
    }
  })(0, []);

  cancelBatch = false;
  modalProgress.max     = combos.length;
  modalProgress.value   = 0;
  modalText.textContent = `0/${combos.length}`;
  batchModal.style.display = 'flex';

  for (let i = 0; i < combos.length; i++) {
    if (cancelBatch) break;
    const combo = combos[i];
    const imgs = combo.map((idx, fi) => {
      const file = folders[fi].files[idx];
      const img  = new Image();
      img.src    = URL.createObjectURL(file);
      return { file, img };
    });
    await Promise.all(imgs.map(o => new Promise(r => {
      o.img.onload = () => { URL.revokeObjectURL(o.img.src); r(); };
    })));

    const maxW = Math.max(...imgs.map(o => o.img.naturalWidth));
    const maxH = Math.max(...imgs.map(o => o.img.naturalHeight));
    const off  = document.createElement('canvas');
    off.width  = maxW;
    off.height = maxH;
    const octx = off.getContext('2d');
    imgs.forEach((o, fi) => {
      if (coordsMap) {
        const c = coordsMap[fi];
        octx.drawImage(o.img, c.x, c.y);
      } else {
        octx.drawImage(o.img, 0, 0);
      }
    });

    const name = combos[i].map((j, fj) =>
      folders[fj].files[j].name.split('.')[0]
    ).join('_') + '.png';
    const handle   = await dirHandle.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    const blob     = await new Promise(r => off.toBlob(r));
    await writable.write(blob);
    await writable.close();

    modalProgress.value   = i + 1;
    modalText.textContent = `${i+1}/${combos.length}`;
  }

  batchModal.style.display = 'none';
  if (!cancelBatch) alert('批量合成完成');
}

// ——— 绘制画布 ———
function drawCanvas() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.scale(scale, scale);

  const step   = 20;
  const startX = Math.floor(-origin.x/step)*step;
  const startY = Math.floor(-origin.y/step)*step;
  const w      = canvas.width/scale;
  const h      = canvas.height/scale;

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth   = 1/scale;
  for (let x = startX; x < startX + w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, startY+h); ctx.stroke();
  }
  for (let y = startY; y < startY + h; y += step) {
    ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX+w, y); ctx.stroke();
  }

  layers.forEach(l => {
    ctx.drawImage(l.img, l.x, l.y);
    if (l.selected) {
      ctx.strokeStyle = '#28a745';
      ctx.lineWidth   = 2/scale;
      ctx.strokeRect(l.x, l.y, l.img.naturalWidth, l.img.naturalHeight);
    }
  });
  ctx.restore();

  coordsDisplay.textContent = activeLayer
    ? `(${activeLayer.x.toFixed(1)},${activeLayer.y.toFixed(1)})`
    : '(-,-)';
}

// ——— 事件绑定 ———
cancelBtn.addEventListener('click', () => cancelBatch = true);

btnDeletePreview.addEventListener('click', () => {
  // handled above
});

btnAddImage.addEventListener('click', () => {
  saveHistory();
  if (selectedThumbIndex === null) return alert('请先选择图片');
  layers.forEach(l => l.selected = false);
  const file = folderFiles[selectedThumbIndex];
  const img  = new Image();
  img.src     = URL.createObjectURL(file);
  img.onload  = () => {
    URL.revokeObjectURL(img.src);
    const newLayer = {
      img,
      x: 0, y: 0,
      name: layers.length.toString(),
      fileName: file.name,
      selected: true
    };
    layers.push(newLayer);
    activeLayer = newLayer;
    renderLayerList();
    drawCanvas();
  };
});

btnNewFolder.addEventListener('click', () => {
  saveHistory();
  folders.push({ name: `Folder_${folders.length}`, files: [] });
  selectedFolderIndex = folders.length - 1;
  renderFolderList();
  renderFolderThumbnails();
});
btnAddToFolder.addEventListener('click', () => {
  if (selectedFolderIndex === null || selectedThumbIndex === null) return;
  saveHistory();
  folders[selectedFolderIndex].files.push(folderFiles[selectedThumbIndex]);
  renderFolderThumbnails();
});
btnSystemAddToFolder.addEventListener('click', () => {
  if (selectedFolderIndex === null) return alert('请先选中文件夹');
  const inp = document.createElement('input');
  inp.type     = 'file';
  inp.multiple = true;
  inp.accept   = 'image/*';
  inp.onchange = e => {
    saveHistory();
    Array.from(e.target.files).forEach(f => {
      folders[selectedFolderIndex].files.push(f);
    });
    renderFolderThumbnails();
  };
  inp.click();
});
btnDeleteFolder.addEventListener('click', () => {
  if (selectedFolderIndex === null) return;
  saveHistory();
  folders.splice(selectedFolderIndex, 1);
  folders.forEach((f, i) => f.name = `Folder_${i}`);
  selectedFolderIndex = selectedFolderThumbIndex = null;
  renderFolderList();
  renderFolderThumbnails();
});
btnDeleteFolderImage.addEventListener('click', () => {
  if (selectedFolderIndex === null || selectedFolderThumbIndex === null) return;
  saveHistory();
  folders[selectedFolderIndex].files.splice(selectedFolderThumbIndex, 1);
  selectedFolderThumbIndex = null;
  renderFolderThumbnails();
});
btnDeleteLayer.addEventListener('click', () => {
  if (!activeLayer) return;
  saveHistory();
  layers = layers.filter(l => l !== activeLayer);
  layers.forEach((l, i) => l.name = i.toString());
  activeLayer = null;
  renderLayerList();
  drawCanvas();
});
btnSaveCoords.addEventListener('click', () => {
  const coords = layers.map(l => ({ name: l.name, x: l.x, y: l.y }));
  const blob   = new Blob([JSON.stringify(coords, null, 2)], { type: 'application/json' });
  const link   = document.createElement('a');
  link.download = 'coords.json';
  link.href     = URL.createObjectURL(blob);
  link.click();
});
btnJump.addEventListener('click', () => {
  if (!activeLayer) return alert('请先选中图层');
  const [nx, ny] = inputCoords.value.split(',').map(v => parseFloat(v));
  if (isNaN(nx) || isNaN(ny)) return alert('请输入有效数字');
  activeLayer.x = nx;
  activeLayer.y = ny;
  drawCanvas();
});

window.addEventListener('keydown', e => {
  if (!e.ctrlKey && !e.metaKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    if (activeLayer) {
      e.preventDefault();
      switch(e.key) {
        case 'ArrowUp':    activeLayer.y -= 1; break;
        case 'ArrowDown':  activeLayer.y += 1; break;
        case 'ArrowLeft':  activeLayer.x -= 1; break;
        case 'ArrowRight': activeLayer.x += 1; break;
      }
      drawCanvas();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    const snap = historyStack.pop(); if (!snap) return;
    layers = snap.layers.map(ld => {
      const file = folderFiles.find(f => f.name === ld.fileName);
      const img  = new Image();
      img.src    = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      return { img, x: ld.x, y: ld.y, name: ld.name, fileName: ld.fileName, selected: ld.selected };
    });
    folders = snap.folders.map(fd => ({
      name: fd.name,
      files: fd.fileNames.map(fn => folderFiles.find(f => f.name === fn))
    }));
    selectedThumbIndex       = snap.selectedThumbIndex;
    selectedFolderIndex      = snap.selectedFolderIndex;
    selectedFolderThumbIndex = snap.selectedFolderThumbIndex;
    renderThumbnails();
    renderFolderList();
    renderFolderThumbnails();
    renderLayerList();
    drawCanvas();
    return;
  }
  if (e.key === 'Delete') {
    if (selectedThumbIndex !== null) {
      btnDeletePreview.click();
    } else if (selectedFolderIndex !== null && selectedFolderThumbIndex !== null) {
      btnDeleteFolderImage.click();
    } else if (activeLayer) {
      btnDeleteLayer.click();
    }
  }
});

btnBatchComposite.addEventListener('click', async () => {
  if (!folders.length || folders.some(f => !f.files.length)) {
    return alert('请确保每个文件夹都有至少一张图片');
  }
  saveHistory();
  const useCoords = confirm('是否按坐标合成？');
  let coordsMap = null;
  if (useCoords) {
    coordsMap = await selectCoordsJson();
    if (!coordsMap) return;
  }
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker();
  } catch {
    return alert('未选择保存目录');
  }
  await compositeAll(coordsMap, dirHandle);
});

canvas.addEventListener('mousedown', e => {
  if (e.altKey) {
    isPanning = true;
    panStart = { x: e.clientX - origin.x, y: e.clientY - origin.y };
  } else {
    const x = (e.offsetX - origin.x) / scale;
    const y = (e.offsetY - origin.y) / scale;
    if (activeLayer &&
        x >= activeLayer.x && x <= activeLayer.x + activeLayer.img.naturalWidth &&
        y >= activeLayer.y && y <= activeLayer.y + activeLayer.img.naturalHeight) {
      isDraggingLayer = true;
      dragOffset = { x: x - activeLayer.x, y: y - activeLayer.y };
    } else {
      isPanning = true;
      panStart = { x: e.clientX - origin.x, y: e.clientY - origin.y };
    }
  }
  drawCanvas();
});
canvas.addEventListener('mousemove', e => {
  if (isDraggingLayer && activeLayer && !e.altKey) {
    activeLayer.x = (e.offsetX - origin.x) / scale - dragOffset.x;
    activeLayer.y = (e.offsetY - origin.y) / scale - dragOffset.y;
    drawCanvas();
  } else if (isPanning) {
    origin.x = e.clientX - panStart.x;
    origin.y = e.clientY - panStart.y;
    drawCanvas();
  }
});
window.addEventListener('mouseup', () => {
  isDraggingLayer = false;
  isPanning = false;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  scale *= e.deltaY > 0 ? 0.9 : 1.1;
  drawCanvas();
});

// ——— 初始渲染 ———
renderThumbnails();
renderFolderList();
renderFolderThumbnails();
renderLayerList();
drawCanvas();
