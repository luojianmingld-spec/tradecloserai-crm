import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/culture-settings/:jid - 获取某个联系人的文化设置
router.get('/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const setting = await prisma.cultureSetting.findUnique({ where: { jid } });
    res.json(setting || { jid, nationality: null, residence: null, useResidence: false });
  } catch (e) {
    console.error('[CultureSettings] GET error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/culture-settings/:jid - 保存/更新文化设置
router.post('/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const { nationality, residence, useResidence } = req.body;
    
    const setting = await prisma.cultureSetting.upsert({
      where: { jid },
      update: {
        nationality: nationality || null,
        residence: residence || null,
        useResidence: !!useResidence,
        updatedAt: new Date(),
      },
      create: {
        jid,
        nationality: nationality || null,
        residence: residence || null,
        useResidence: !!useResidence,
      },
    });
    
    res.json(setting);
  } catch (e) {
    console.error('[CultureSettings] POST error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/culture-settings/:jid - 删除文化设置
router.delete('/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    await prisma.cultureSetting.deleteMany({ where: { jid } });
    res.json({ success: true });
  } catch (e) {
    console.error('[CultureSettings] DELETE error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
