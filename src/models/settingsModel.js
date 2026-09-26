/**
 * Site-wide settings (header / footer) stored as documents keyed by name.
 */

const { getDb } = require('../db/connect');

const DEFAULTS = {
  header: {
    logoText: 'WebDev Learn',
    logoImage: '',
    navItems: [
      { label: 'Home', url: '/', type: 'link' },
    ],
  },
  footer: {
    aboutText: 'Progressive web development curriculum. Learn HTML, CSS and JavaScript week by week.',
    logoImage: '',
    columns: [],
    social: [
      { label: 'GitHub', url: 'https://github.com', icon: '🔗' },
    ],
    copyright: 'Web Development Learning Platform',
  },
};

async function getSetting(key) {
  const db = getDb();
  const doc = await db.collection('settings').findOne({ key });
  if (doc && doc.data) return doc.data;
  return DEFAULTS[key] ? { ...DEFAULTS[key] } : null;
}

async function setSetting(key, data) {
  const db = getDb();
  await db.collection('settings').updateOne(
    { key },
    { $set: { key, data, updatedAt: new Date() } },
    { upsert: true }
  );
  return data;
}

async function getHeader() {
  return getSetting('header');
}

async function getFooter() {
  return getSetting('footer');
}

async function saveHeader(data) {
  return setSetting('header', data);
}

async function saveFooter(data) {
  return setSetting('footer', data);
}

module.exports = {
  DEFAULTS,
  getSetting,
  setSetting,
  getHeader,
  getFooter,
  saveHeader,
  saveFooter,
};
