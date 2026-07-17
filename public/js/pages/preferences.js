// Personal preferences: theme, language, and account (change password).
import { h, mount } from '../ui.js';
import { t, getLang, setLang } from '../i18n.js';
import { storedTheme } from '../app.js';
import { openChangePassword } from '../account.js';

const THEMES = [
  { id: 'light', key: 'prefs.light' },
  { id: 'dark', key: 'prefs.dark' },
  { id: 'futuristic', key: 'prefs.futuristic' },
];

export async function render(root) {
  function paint() {
    const cur = storedTheme() === 'system' ? 'light' : storedTheme();

    const themeCards = THEMES.map((th) => {
      const card = h('button', { class: 'theme-card' + (cur === th.id ? ' sel' : '') },
        h('div', { class: 'theme-swatch ' + th.id }),
        h('div', { style: { fontWeight: '600' } }, t(th.key)));
      card.addEventListener('click', () => { window.__kt.setTheme(th.id); paint(); });
      return card;
    });

    const langSeg = h('div', { class: 'seg' },
      h('button', { class: getLang() === 'en' ? 'sel' : '', onClick: () => { setLang('en'); window.__kt.relayout(); } }, t('prefs.english')),
      h('button', { class: getLang() === 'th' ? 'sel' : '', onClick: () => { setLang('th'); window.__kt.relayout(); } }, t('prefs.thai')));

    mount(root,
      h('p', { class: 'page-intro' }, t('prefs.intro')),
      h('div', { class: 'card', style: { marginBottom: '18px' } },
        h('div', { class: 'card__head' }, h('h3', {}, t('prefs.appearance'))),
        h('div', { class: 'card__pad' },
          h('div', { class: 'field' }, h('label', {}, t('prefs.theme')), h('div', { class: 'theme-grid' }, themeCards), h('div', { class: 'hint' }, t('prefs.themeHint'))),
          h('div', { class: 'field', style: { marginBottom: '0' } }, h('label', {}, t('prefs.language')), langSeg, h('div', { class: 'hint' }, t('prefs.langHint')))
        )
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', {}, t('prefs.account'))),
        h('div', { class: 'card__pad' },
          h('button', { class: 'btn', onClick: openChangePassword }, t('pw.change')))
      )
    );
  }
  paint();
}
