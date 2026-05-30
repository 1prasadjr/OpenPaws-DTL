const { prisma } = require('../config/prisma');
const { donationSelect, shapeDonation } = require('./donation.service');

const getDashboardSummary = async () => {
  const [donorsTotal, donationsTotal, amountAggregate, recentDonations] = await Promise.all([
    prisma.donors.count(),
    prisma.donations.count(),
    prisma.donations.aggregate({
      _sum: {
        amount: true,
      },
    }),
    prisma.donations.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
      select: donationSelect,
    }),
  ]);

  return {
    donorsTotal,
    donationsTotal,
    amountTotal: Number(amountAggregate?._sum?.amount || 0),
    recentDonations: recentDonations.map(shapeDonation),
  };
};

module.exports = {
  getDashboardSummary,
};