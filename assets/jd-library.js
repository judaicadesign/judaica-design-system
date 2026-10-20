/* Judaica Design® — Biblioteca Institucional, interfaz de solo lectura.
 * La única fuente editable es Drive. El navegador consulta únicamente datos con RLS.
 * Ningún documento ni credencial privada se incluye en el repositorio público.
 */
(() => {
  'use strict';
  const root = document.getElementById('library');
  if (!root) return;
  const $ = id => document.getElementById(id);
  const state = { docs: [], loaded: false, selected: null, request: 0 };
  const text = (tag, content, cls) => {
    const e = document.createElement(tag);
    e.textContent = content == null ? '' : String(content);
    if (cls) e.className = cls;
    return e;
  };
  const empty = node => node.replaceChildren();
  const client = () => window.jdSupabase;
  const safeDrive = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' &&
        ['docs.google.com', 'drive.google.com'].includes(url.hostname) ? url.href : '';
    } catch (_) { return ''; }
  };
  const status = message => { $('jdLibraryStatus').textContent = message; };
  const norm = value => String(value || '').toLocaleLowerCase('es');
  const moduleTitle = row => row.module_code ? row.module_code + ' · ' + row.title : row.title;

  function card(row) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'jd-library-card';
    el.setAttribute('aria-label', 'Leer ' + row.title);
    el.append(text('span', row.category || 'Biblioteca', 'jd-library-overline'));
    el.append(text('strong', moduleTitle(row)));
    el.append(text('span', (row.editorial_status || 'borrador') + (row.version ? ' · v' + row.version : ''), 'jd-library-meta'));
    el.addEventListener('click', () => open(row.drive_file_id));
    return el;
  }

  function showCards(docs) {
    const holder = $('jdLibraryCards');
    empty(holder);
    if (!docs.length) {
      holder.append(text('p', state.loaded ?
        'No hay documentos que coincidan o que tengas permiso para consultar.' :
        'Todavía no hay documentos sincronizados.', 'jd-library-empty'));
      return;
    }
    for (const item of docs) holder.append(card(item));
  }

  async function load() {
    const api = client();
    if (!api) { status('Iniciá sesión para consultar la Biblioteca JD.'); return; }
    status('Cargando documentación privada…');
    const { data, error } = await api.from('jd_library_documents')
      .select('drive_file_id,title,module_code,category,editorial_status,access_level,version,drive_url,synced_at')
      .order('module_code', { ascending: true }).limit(250);
    if (error) { status('No se pudo leer la Biblioteca: ' + error.message); return; }
    state.docs = Array.isArray(data) ? data : [];
    state.loaded = true;
    const input = $('jdLibrarySearch');
    status(state.docs.length + ' documentos disponibles · acceso privado');
    showCards(state.docs.filter(row => !input.value || norm(moduleTitle(row) + ' ' + row.category).includes(norm(input.value))));
  }

  function readerSections(view, doc) {
    const sections = (Array.isArray(doc.sections) ? doc.sections : [])
      .filter(s => Number.isSafeInteger(s.offset) && s.offset >= 0 && s.offset < doc.content_text.length &&
        typeof s.title === 'string' && s.title.length <= 260)
      .sort((a,b) => a.offset - b.offset);
    const toc = $('jdLibraryToc');
    const body = $('jdLibraryBody');
    empty(toc); empty(body);
    if (!sections.length) {
      body.append(text('div', doc.content_text || 'Todavía no hay texto sincronizado.', 'jd-library-prose'));
      return;
    }
    if (sections[0].offset > 0) body.append(text('div', doc.content_text.slice(0, sections[0].offset), 'jd-library-prose'));
    for (let i=0; i<sections.length; i++) {
      const s = sections[i], next = sections[i + 1]?.offset ?? doc.content_text.length;
      if (next <= s.offset) continue;
      const part = document.createElement('section');
      part.className = 'jd-library-chapter';
      part.id = 'jd-library-chapter-' + i;
      const heading = text('h3', s.title);
      const content = doc.content_text.slice(s.offset, next);
      part.append(heading, text('div', content.startsWith(s.title) ? content.slice(s.title.length).trim() : content, 'jd-library-prose'));
      body.append(part);
      const link = text('button', s.title);
      link.type = 'button';
      link.className = 'jd-library-toc-item';
      link.addEventListener('click', () => part.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      toc.append(link);
    }
  }

  async function open(id) {
    const api = client();
    if (!api) return;
    state.selected = id;
    $('jdLibraryListView').hidden = true;
    $('jdLibraryReader').hidden = false;
    $('jdLibraryDocumentTitle').textContent = 'Cargando documento…';
    $('jdLibraryDocumentMeta').textContent = '';
    empty($('jdLibraryBody')); empty($('jdLibraryToc'));
    const {data, error} = await api.from('jd_library_documents')
      .select('drive_file_id,title,module_code,category,editorial_status,version,drive_url,synced_at,content_text,sections')
      .eq('drive_file_id', id).single();
    if (state.selected !== id) return;
    if (error || !data) {
      $('jdLibraryDocumentTitle').textContent = 'No se pudo abrir';
      $('jdLibraryDocumentMeta').textContent = 'Documento no disponible o sin permisos.';
      return;
    }
    $('jdLibraryDocumentTitle').textContent = data.title;
    const stamp = data.synced_at ? new Date(data.synced_at).toLocaleString('es-AR') : 'sin sincronizar';
    $('jdLibraryDocumentMeta').textContent =
      (data.editorial_status || 'borrador') + ' · ' + (data.version ? 'v' + data.version + ' · ' : '') +
      'Espejo de Drive: ' + stamp;
    const source = $('jdLibrarySource');
    const href = safeDrive(data.drive_url);
    source.hidden = !href;
    if (href) source.href = href; else source.removeAttribute('href');
    readerSections(root, data);
  }

  async function search(query) {
    const id = ++state.request;
    const q = query.trim();
    if (!q) { status(state.docs.length + ' documentos disponibles · acceso privado'); showCards(state.docs); return; }
    if (q.length < 2) {
      showCards(state.docs.filter(row => norm(moduleTitle(row)).includes(norm(q)))); return;
    }
    status('Buscando en la Biblioteca…');
    const api = client();
    if (!api) return;
    const {data,error} = await api.rpc('jd_library_search',{search_text:q,result_limit:50});
    if (id !== state.request) return;
    if (error) { status('No se pudo buscar: ' + error.message); return; }
    const found = Array.isArray(data) ? data : [];
    status(found.length + ' resultados para «' + q + '»');
    showCards(found);
  }

  $('jdLibrarySearch').addEventListener('input', event => {
    // El filtro busca al escribir, sin enviar datos a terceros.
    search(String(event.target.value || '')).catch(() => status('Error al buscar.'));
  });
  $('jdLibraryBack').addEventListener('click', () => {
    state.selected = null;
    $('jdLibraryReader').hidden = true;
    $('jdLibraryListView').hidden = false;
  });
  document.querySelector('#nav button[data-screen="library"]')
    ?.addEventListener('click', () => { if (!state.loaded) load().catch(() => status('Error al cargar.')); });
  window.JDLibrary = Object.freeze({ reload: load });
})();
