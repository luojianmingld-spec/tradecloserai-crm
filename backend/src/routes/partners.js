/**
 * Partner Management API Routes
 * Handles factory and freight forwarder partners
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── Partner CRUD ───

// List partners (with type filter)
router.get('/', async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const where = { tenantId: req.tenantId || 1 };
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { mainProducts: { contains: search, mode: 'insensitive' } },
        { routes: { contains: search, mode: 'insensitive' } },
      ];
    }
    const partners = await prisma.partner.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 5 },
        shipments: { orderBy: { createdAt: 'desc' }, take: 5 },
        _count: { select: { orders: true, shipments: true, messages: true } },
      },
    });
    res.json(partners);
  } catch (err) {
    console.error('[Partners] List error:', err);
    res.status(500).json({ error: '获取合作伙伴列表失败' });
  }
});

// Get single partner
router.get('/:id', async (req, res) => {
  try {
    const partner = await prisma.partner.findFirst({
      where: { id: parseInt(req.params.id), tenantId: req.tenantId || 1 },
      include: {
        orders: { orderBy: { createdAt: 'desc' } },
        shipments: { orderBy: { createdAt: 'desc' } },
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!partner) return res.status(404).json({ error: '合作伙伴不存在' });
    res.json(partner);
  } catch (err) {
    console.error('[Partners] Get error:', err);
    res.status(500).json({ error: '获取合作伙伴详情失败' });
  }
});

// Create partner
router.post('/', async (req, res) => {
  try {
    const {
      type, companyName, contactName, phone, email, address, notes,
      // factory fields
      mainProducts, moq, priceRange, qualityLevel, factoryTags,
      // freight fields
      routes, serviceTypes, carrierPref,
    } = req.body;

    if (!type || !companyName) {
      return res.status(400).json({ error: '类型和公司名称为必填' });
    }

    const partner = await prisma.partner.create({
      data: {
        tenantId: req.tenantId || 1,
        type,
        companyName,
        contactName, phone, email, address, notes,
        mainProducts, moq, priceRange, qualityLevel, factoryTags,
        routes, serviceTypes, carrierPref,
      },
    });
    res.json(partner);
  } catch (err) {
    console.error('[Partners] Create error:', err);
    res.status(500).json({ error: '创建合作伙伴失败' });
  }
});

// Update partner
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.partner.findFirst({
      where: { id: parseInt(req.params.id), tenantId: req.tenantId || 1 },
    });
    if (!existing) return res.status(404).json({ error: '合作伙伴不存在' });

    const updated = await prisma.partner.update({
      where: { id: existing.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    console.error('[Partners] Update error:', err);
    res.status(500).json({ error: '更新合作伙伴失败' });
  }
});

// Delete partner
router.delete('/:id', async (req, res) => {
  try {
    await prisma.partner.deleteMany({
      where: { id: parseInt(req.params.id), tenantId: req.tenantId || 1 },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[Partners] Delete error:', err);
    res.status(500).json({ error: '删除合作伙伴失败' });
  }
});

// ─── Orders (Factory) ───

router.post('/:id/orders', async (req, res) => {
  try {
    const partnerId = parseInt(req.params.id);
    const { orderNo, productName, quantity, unitPrice, currency, orderDate, estimatedCompletion, notes } = req.body;
    const order = await prisma.partnerOrder.create({
      data: {
        tenantId: req.tenantId || 1,
        partnerId,
        orderNo, productName, quantity, unitPrice,
        totalPrice: unitPrice && quantity ? unitPrice * parseFloat(quantity) : null,
        currency: currency || 'USD',
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        estimatedCompletion: estimatedCompletion ? new Date(estimatedCompletion) : null,
        notes,
        trackingLog: JSON.stringify([{ time: new Date().toISOString(), status: 'pending', note: '订单创建' }]),
      },
    });
    // Update partner lastContactAt
    await prisma.partner.update({ where: { id: partnerId }, data: { lastContactAt: new Date() } });
    res.json(order);
  } catch (err) {
    console.error('[Partners] Create order error:', err);
    res.status(500).json({ error: '创建订单失败' });
  }
});

router.put('/:id/orders/:orderId', async (req, res) => {
  try {
    const { status, notes, actualCompletion, productionStart } = req.body;
    const orderId = parseInt(req.params.orderId);
    const updateData = { ...req.body };
    
    // Append to tracking log
    if (status) {
      const existing = await prisma.partnerOrder.findUnique({ where: { id: orderId } });
      const log = existing?.trackingLog ? JSON.parse(existing.trackingLog) : [];
      log.push({ time: new Date().toISOString(), status, note: notes || `状态更新为${status}` });
      updateData.trackingLog = JSON.stringify(log);
    }
    if (productionStart) updateData.productionStart = new Date(productionStart);
    if (actualCompletion) updateData.actualCompletion = new Date(actualCompletion);

    const order = await prisma.partnerOrder.update({ where: { id: orderId }, data: updateData });
    res.json(order);
  } catch (err) {
    console.error('[Partners] Update order error:', err);
    res.status(500).json({ error: '更新订单失败' });
  }
});

// ─── Shipments (Freight) ───

router.post('/:id/shipments', async (req, res) => {
  try {
    const partnerId = parseInt(req.params.id);
    const { shipmentNo, type, origin, destination, cargoDesc, weight, volume, containers, freightCost, currency, etd, eta, notes } = req.body;
    const shipment = await prisma.partnerShipment.create({
      data: {
        tenantId: req.tenantId || 1,
        partnerId,
        shipmentNo, type: type || 'FCL',
        origin, destination, cargoDesc, weight, volume, containers,
        freightCost, currency: currency || 'USD',
        etd: etd ? new Date(etd) : null,
        eta: eta ? new Date(eta) : null,
        notes,
        trackingLog: JSON.stringify([{ time: new Date().toISOString(), status: 'inquiring', note: '运输单创建' }]),
      },
    });
    await prisma.partner.update({ where: { id: partnerId }, data: { lastContactAt: new Date() } });
    res.json(shipment);
  } catch (err) {
    console.error('[Partners] Create shipment error:', err);
    res.status(500).json({ error: '创建运输单失败' });
  }
});

router.put('/:id/shipments/:shipId', async (req, res) => {
  try {
    const { status, notes, atd, ata } = req.body;
    const shipId = parseInt(req.params.shipId);
    const updateData = { ...req.body };
    
    if (status) {
      const existing = await prisma.partnerShipment.findUnique({ where: { id: shipId } });
      const log = existing?.trackingLog ? JSON.parse(existing.trackingLog) : [];
      log.push({ time: new Date().toISOString(), status, note: notes || `状态更新为${status}` });
      updateData.trackingLog = JSON.stringify(log);
    }
    if (atd) updateData.atd = new Date(atd);
    if (ata) updateData.ata = new Date(ata);

    const shipment = await prisma.partnerShipment.update({ where: { id: shipId }, data: updateData });
    res.json(shipment);
  } catch (err) {
    console.error('[Partners] Update shipment error:', err);
    res.status(500).json({ error: '更新运输单失败' });
  }
});

// ─── Messages ───

router.post('/:id/messages', async (req, res) => {
  try {
    const partnerId = parseInt(req.params.id);
    const { direction, channel, content, aiGenerated } = req.body;
    const msg = await prisma.partnerMessage.create({
      data: {
        tenantId: req.tenantId || 1,
        partnerId,
        direction: direction || 'outbound',
        channel: channel || 'manual',
        content,
        aiGenerated: aiGenerated || false,
      },
    });
    await prisma.partner.update({ where: { id: partnerId }, data: { lastContactAt: new Date() } });
    res.json(msg);
  } catch (err) {
    console.error('[Partners] Create message error:', err);
    res.status(500).json({ error: '记录消息失败' });
  }
});

// ─── Stats ───

router.get('/stats/overview', async (req, res) => {
  try {
    const tenantId = req.tenantId || 1;
    const [factoryCount, freightCount, activeOrders, activeShipments] = await Promise.all([
      prisma.partner.count({ where: { tenantId, type: 'factory', status: 'active' } }),
      prisma.partner.count({ where: { tenantId, type: 'freight', status: 'active' } }),
      prisma.partnerOrder.count({ where: { tenantId, status: { notIn: ['completed', 'cancelled'] } } }),
      prisma.partnerShipment.count({ where: { tenantId, status: { notIn: ['delivered'] } } }),
    ]);
    res.json({ factoryCount, freightCount, activeOrders, activeShipments });
  } catch (err) {
    console.error('[Partners] Stats error:', err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

export default router;
