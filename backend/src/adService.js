import db from './database.js';

// Initialize ad settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS ad_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    ads_enabled INTEGER DEFAULT 0,
    adsense_publisher_id TEXT,
    header_ad_enabled INTEGER DEFAULT 0,
    header_ad_slot TEXT,
    sidebar_ad_enabled INTEGER DEFAULT 0,
    sidebar_ad_slot TEXT,
    content_ad_enabled INTEGER DEFAULT 0,
    content_ad_slot TEXT,
    footer_ad_enabled INTEGER DEFAULT 0,
    footer_ad_slot TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert default settings if not exists
  INSERT OR IGNORE INTO ad_settings (id) VALUES ('global');
`);

/**
 * Get ad settings
 */
export function getAdSettings() {
  const settings = db.prepare('SELECT * FROM ad_settings WHERE id = ?').get('global');
  
  return {
    adsEnabled: !!settings.ads_enabled,
    adsensePublisherId: settings.adsense_publisher_id || '',
    placements: {
      header: {
        enabled: !!settings.header_ad_enabled,
        slot: settings.header_ad_slot || ''
      },
      sidebar: {
        enabled: !!settings.sidebar_ad_enabled,
        slot: settings.sidebar_ad_slot || ''
      },
      content: {
        enabled: !!settings.content_ad_enabled,
        slot: settings.content_ad_slot || ''
      },
      footer: {
        enabled: !!settings.footer_ad_enabled,
        slot: settings.footer_ad_slot || ''
      }
    }
  };
}

/**
 * Update ad settings
 */
export function updateAdSettings({
  adsEnabled,
  adsensePublisherId,
  placements
}) {
  const current = getAdSettings();
  
  const updates = {
    ads_enabled: adsEnabled !== undefined ? (adsEnabled ? 1 : 0) : (current.adsEnabled ? 1 : 0),
    adsense_publisher_id: adsensePublisherId ?? current.adsensePublisherId,
    header_ad_enabled: placements?.header?.enabled !== undefined ? (placements.header.enabled ? 1 : 0) : (current.placements.header.enabled ? 1 : 0),
    header_ad_slot: placements?.header?.slot ?? current.placements.header.slot,
    sidebar_ad_enabled: placements?.sidebar?.enabled !== undefined ? (placements.sidebar.enabled ? 1 : 0) : (current.placements.sidebar.enabled ? 1 : 0),
    sidebar_ad_slot: placements?.sidebar?.slot ?? current.placements.sidebar.slot,
    content_ad_enabled: placements?.content?.enabled !== undefined ? (placements.content.enabled ? 1 : 0) : (current.placements.content.enabled ? 1 : 0),
    content_ad_slot: placements?.content?.slot ?? current.placements.content.slot,
    footer_ad_enabled: placements?.footer?.enabled !== undefined ? (placements.footer.enabled ? 1 : 0) : (current.placements.footer.enabled ? 1 : 0),
    footer_ad_slot: placements?.footer?.slot ?? current.placements.footer.slot
  };
  
  db.prepare(`
    UPDATE ad_settings SET
      ads_enabled = ?,
      adsense_publisher_id = ?,
      header_ad_enabled = ?,
      header_ad_slot = ?,
      sidebar_ad_enabled = ?,
      sidebar_ad_slot = ?,
      content_ad_enabled = ?,
      content_ad_slot = ?,
      footer_ad_enabled = ?,
      footer_ad_slot = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 'global'
  `).run(
    updates.ads_enabled,
    updates.adsense_publisher_id,
    updates.header_ad_enabled,
    updates.header_ad_slot,
    updates.sidebar_ad_enabled,
    updates.sidebar_ad_slot,
    updates.content_ad_enabled,
    updates.content_ad_slot,
    updates.footer_ad_enabled,
    updates.footer_ad_slot
  );
  
  return getAdSettings();
}

/**
 * Toggle ads globally
 */
export function toggleAds(enabled) {
  db.prepare(`
    UPDATE ad_settings SET ads_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'global'
  `).run(enabled ? 1 : 0);
  
  return getAdSettings();
}

export default {
  getAdSettings,
  updateAdSettings,
  toggleAds
};
