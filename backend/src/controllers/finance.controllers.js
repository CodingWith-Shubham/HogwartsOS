import { Payment } from "../models/payment.models.js";
import { Client } from "../models/client.models.js";
import { UpsellCrossSell } from "../models/upsellCrossSell.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/** Safely parses DD/MM/YYYY, YYYY-MM-DD, or ISO strings into a Date object */
function parseSafeDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(`${year}-${month}-${day}T00:00:00`);
    }
  }
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  return new Date(dateStr + 'T00:00:00');
}

function normalizeService(service) {
  if (!service) return 'Other';
  const s = service.toLowerCase();
  if (s.includes('podcast')) return 'Podcast';
  if (s.includes('reel')) return 'Reel';
  if (s.includes('brand')) return 'Brand Film';
  if (s.includes('product')) return 'Product Video';
  if (s.includes('event') || s.includes('coverage')) return 'Event Coverage';
  if (s.includes('social') || s.includes('media')) return 'Social Media';
  if (s.includes('rent') || s.includes('teleprompter') || s.includes('camera')) return 'Rentals';
  return 'Other';
}

const getFinanceDashboard = asyncHandler(async (req, res) => {
    const { startDate, endDate, clientId, salesperson, serviceType, paymentStatus } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = end;
        }
    }

    // Fetch payments matching date
    const payments = await Payment.find(dateFilter).lean();

    // Collect leadIds and upsellCrossSellIds
    const leadIds = [...new Set(payments.map(p => p.leadId).filter(Boolean))];
    const upsellIds = [...new Set(payments.map(p => p.upsellCrossSellId).filter(Boolean))];

    const [clients, upsells] = await Promise.all([
        Client.find({ leadId: { $in: leadIds } }).lean(),
        UpsellCrossSell.find({ _id: { $in: upsellIds } }).lean()
    ]);

    const clientMap = {};
    clients.forEach(c => { clientMap[c.leadId] = c; });
    
    const upsellMap = {};
    upsells.forEach(u => { upsellMap[u._id.toString()] = u; });

    // Build the rich invoice list
    let invoices = payments.map(p => {
        const amountVal = parseFloat(p.amount) || 0;
        const statusLower = (p.paymentStatus || '').trim().toLowerCase();

        let status = 'unpaid';
        const isVerified = ['payment verified', 'payment confirmed', 'confirmed'].includes(statusLower);
        const isPendingVer = ['pending verification', 'screenshot uploaded', 'screenshot received', 'screenshot uploaded - pending verification'].includes(statusLower);

        if (isVerified) {
            status = 'paid';
        } else if (isPendingVer) {
            status = 'partial'; // Or we can call it 'pending'
        } else {
            status = 'unpaid';
        }

        const linkSentDate = p.paymentLinkSentAt ? parseSafeDate(p.paymentLinkSentAt) : null;
        let dueDateStr = '';
        let dueDateObj = null;
        if (linkSentDate && !isNaN(linkSentDate.getTime())) {
            dueDateObj = new Date(linkSentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            dueDateStr = dueDateObj.toISOString();
            if (status !== 'paid' && Date.now() > dueDateObj.getTime()) {
                status = 'overdue';
            }
        } else {
            dueDateObj = new Date(p.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // fallback to 7 days from creation
            dueDateStr = dueDateObj.toISOString();
            if (status !== 'paid' && Date.now() > dueDateObj.getTime()) {
                status = 'overdue';
            }
        }

        const isUpsell = !!p.upsellCrossSellId;
        let assignedTo = 'Unknown';
        let rawService = 'Other';
        let projClientId = p.leadId;
        let clientPhone = '';
        
        if (isUpsell && upsellMap[p.upsellCrossSellId]) {
            const u = upsellMap[p.upsellCrossSellId];
            assignedTo = u.assignedTo || 'Unknown';
            clientPhone = u.clientPhone || '';
            if (u.services && u.services.length > 0) {
                rawService = u.services[0];
            } else if (u.deliverableSets && u.deliverableSets.length > 0) {
                rawService = u.deliverableSets[0].serviceName || 'Other';
            }
            projClientId = u.clientId?.toString() || p.leadId;
        } else if (!isUpsell && clientMap[p.leadId]) {
            const c = clientMap[p.leadId];
            assignedTo = c.assignedTo || 'Unknown';
            clientPhone = c.phoneNumber || '';
            rawService = c.servicePitched || 'Other';
            if (!rawService || rawService === 'Other') {
                const sets = c.deliverableSets?.length ? c.deliverableSets : c.deliverable_sets;
                if (sets && sets.length > 0) {
                    rawService = sets[0].serviceName || 'Other';
                }
            }
        }

        const normService = normalizeService(rawService);

        // Determine age for aging breakdown (only for unpaid/overdue)
        let daysOld = 0;
        if (status === 'unpaid' || status === 'overdue' || status === 'partial') {
            const genDate = (linkSentDate && !isNaN(linkSentDate.getTime())) ? linkSentDate : p.createdAt;
            daysOld = Math.floor((Date.now() - genDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOld < 0) daysOld = 0;
        }

        return {
            id: p.paymentId || p._id.toString(),
            projectId: p.leadId,
            clientName: p.clientName || 'Unknown Client',
            clientId: projClientId,
            clientPhone,
            amount: amountVal,
            status,
            dueDate: dueDateStr,
            paidDate: isVerified ? (p.verifiedAt || p.paymentLinkSentAt) : undefined,
            type: p.installmentLabel || (p.installmentNumber === '1' ? 'advance' : 'installment'),
            isUpsell,
            assignedTo,
            serviceType: normService,
            daysOld,
            createdAt: p.createdAt
        };
    });

    // Apply Filters
    if (clientId) {
        const queryLower = clientId.toLowerCase();
        invoices = invoices.filter(i => 
            (i.clientId && i.clientId.toLowerCase().includes(queryLower)) || 
            (i.projectId && i.projectId.toLowerCase().includes(queryLower)) ||
            (i.clientName && i.clientName.toLowerCase().includes(queryLower)) ||
            (i.clientPhone && i.clientPhone.toLowerCase().includes(queryLower)) ||
            (i.id && i.id.toLowerCase().includes(queryLower))
        );
    }
    if (salesperson) {
        const spLower = salesperson.toLowerCase();
        invoices = invoices.filter(i => i.assignedTo && i.assignedTo.toLowerCase().includes(spLower));
    }
    if (serviceType) {
        const stLower = serviceType.toLowerCase();
        if (stLower !== 'all') {
            invoices = invoices.filter(i => i.serviceType.toLowerCase() === stLower);
        }
    }
    if (paymentStatus) {
        const psLower = paymentStatus.toLowerCase();
        if (psLower !== 'all') {
             // In frontend: unpaid + partial = pending
             if (psLower === 'pending') {
                 invoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'partial');
             } else {
                 invoices = invoices.filter(i => i.status === psLower);
             }
        }
    }

    // Aggregations
    let totalCollected = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;
    let totalInvoicesCount = invoices.length;

    const revByService = {};
    const revByClient = {};
    const revBySalesperson = {};
    let newSaleRev = 0;
    let upsellRev = 0;
    
    let aging0_15 = 0;
    let aging16_30 = 0;
    let aging30plus = 0;

    invoices.forEach(inv => {
        const isPaid = inv.status === 'paid';
        
        if (isPaid) {
            totalCollected += inv.amount;
            
            // Breakdowns only count collected revenue
            revByService[inv.serviceType] = (revByService[inv.serviceType] || 0) + inv.amount;
            revByClient[inv.clientName] = (revByClient[inv.clientName] || 0) + inv.amount;
            
            const sp = inv.assignedTo || 'Unknown';
            revBySalesperson[sp] = (revBySalesperson[sp] || 0) + inv.amount;

            if (inv.isUpsell) {
                upsellRev += inv.amount;
            } else {
                newSaleRev += inv.amount;
            }
        } else {
            if (inv.status === 'overdue') {
                overdueAmount += inv.amount;
            } else {
                pendingAmount += inv.amount;
            }
            
            // Aging breakdown
            if (inv.daysOld <= 15) {
                aging0_15 += inv.amount;
            } else if (inv.daysOld <= 30) {
                aging16_30 += inv.amount;
            } else {
                aging30plus += inv.amount;
            }
        }
    });

    // Format charts data
    const chartRevenueByService = Object.keys(revByService).map(k => ({ name: k, value: revByService[k] }));
    const chartRevenueByClient = Object.keys(revByClient).map(k => ({ name: k, value: revByClient[k] })).sort((a,b) => b.value - a.value).slice(0, 10); // top 10
    const chartRevenueBySalesperson = Object.keys(revBySalesperson).map(k => ({ name: k, value: revBySalesperson[k] }));

    return res.status(200).json(new ApiResponse(200, {
        metrics: {
            totalCollected,
            pendingAmount,
            overdueAmount,
            totalInvoicesCount
        },
        breakdowns: {
            revenueByService: chartRevenueByService,
            revenueByClient: chartRevenueByClient,
            revenueBySalesperson: chartRevenueBySalesperson,
            upsellVsNewSale: [
                { name: 'New Sale', value: newSaleRev },
                { name: 'Upsell/Cross-sell', value: upsellRev }
            ],
            aging: [
                { name: '0-15 Days', value: aging0_15 },
                { name: '16-30 Days', value: aging16_30 },
                { name: '30+ Days', value: aging30plus }
            ]
        },
        invoices
    }, "Finance dashboard data retrieved"));
});

export { getFinanceDashboard };
