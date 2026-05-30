const { prisma, Prisma } = require('../config/prisma');

const buildDonationWhere = ({ search, status }) => {
  const where = {};

  if (status) {
    where.acknowledgment_status = status;
  }

  if (search) {
    const term = search.trim();

    if (term) {
      where.OR = [
        { donation_id: { contains: term, mode: 'insensitive' } },
        { donor_name: { contains: term, mode: 'insensitive' } },
        { donor_email: { contains: term, mode: 'insensitive' } },
        { campaign: { contains: term, mode: 'insensitive' } },
        { designation: { contains: term, mode: 'insensitive' } },
      ];
    }
  }

  return where;
};

const normalizePagination = (pageValue, limitValue) => {
  const page = Number.parseInt(pageValue, 10);
  const limit = Number.parseInt(limitValue, 10);

  return {
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    limit: Number.isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100),
  };
};

const donationSelect = {
  id: true,
  donation_id: true,
  donor_id: true,
  donor_name: true,
  donor_email: true,
  amount: true,
  currency: true,
  donation_date: true,
  campaign: true,
  designation: true,
  recurring_status: true,
  source: true,
  acknowledgment_status: true,
  created_at: true,
  updated_at: true,
  donors: {
    select: {
      id: true,
      donor_code: true,
      first_name: true,
      last_name: true,
      full_name: true,
      email: true,
      donor_type: true,
    },
  },
};

const shapeDonation = (record) => {
  if (!record) {
    return record;
  }

  const { donors, ...donation } = record;

  return {
    ...donation,
    donor: donors || null,
  };
};

const getDonations = async (filters = {}) => {
  const { page, limit } = normalizePagination(filters.page, filters.limit);
  const where = buildDonationWhere(filters);

  const [total, data] = await Promise.all([
    prisma.donations.count({ where }),
    prisma.donations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: donationSelect,
    }),
  ]);

  return {
    data: data.map(shapeDonation),
    pagination: {
      page,
      limit,
      total,
    },
  };
};

const getDonationById = async (id) => {
  const donation = await prisma.donations.findUnique({
    where: { id },
    select: donationSelect,
  });

  return shapeDonation(donation);
};

const getDonationByDonationId = async (donationId) => {
  const donation = await prisma.donations.findUnique({
    where: { donation_id: donationId },
    select: donationSelect,
  });

  return shapeDonation(donation);
};

const createDonation = async (payload) => {
  const existingDonation = await prisma.donations.findUnique({
    where: { donation_id: payload.donation_id },
    select: { id: true },
  });

  if (existingDonation) {
    const error = new Error('Donation ID already exists');
    error.statusCode = 409;
    throw error;
  }

  const donor = await prisma.donors.findUnique({
    where: { email: payload.donor_email },
    select: { id: true },
  });

  const data = {
    donation_id: payload.donation_id,
    donor_name: payload.donor_name,
    donor_email: payload.donor_email,
    amount: new Prisma.Decimal(payload.amount),
    donation_date: payload.donation_date,
    acknowledgment_status: 'received',
    currency: payload.currency || 'USD',
    campaign: payload.campaign,
    designation: payload.designation,
    recurring_status: payload.recurring_status || 'one_time',
    source: payload.source || 'synthetic',
  };

  if (donor) {
    data.donor_id = donor.id;
  }

  const donation = await prisma.donations.create({
    data,
    select: donationSelect,
  });

  return shapeDonation(donation);
};

module.exports = {
  getDonations,
  getDonationById,
  getDonationByDonationId,
  createDonation,
  donationSelect,
  shapeDonation,
};
