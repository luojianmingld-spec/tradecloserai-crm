import { Router } from 'express';
import {
  getTranslationSettings,
  updateSettings,
  updateSetting,
} from '../services/translation.js';

const router = Router();

// Get all settings for current user
router.get('/', async (req, res) => {
  try {
    const settings = await getTranslationSettings(req.userId);
    res.json(settings);
  } catch (err) {
    console.error('[Settings] Get error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings (batch) - accepts { settings: [{ key, value }, ...] }
router.put('/', async (req, res) => {
  try {
    const { settings } = req.body;
    if (Array.isArray(settings)) {
      const ops = settings.map(({ key, value }) =>
        updateSetting(req.userId, key, String(value))
      );
      await Promise.all(ops);
    } else {
      await updateSettings(req.userId, req.body);
    }
    const updated = await getTranslationSettings(req.userId);
    res.json(updated);
  } catch (err) {
    console.error('[Settings] Update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Update single setting
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await updateSetting(req.userId, key, value);
    res.json({ key, value });
  } catch (err) {
    console.error('[Settings] Update single error:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
