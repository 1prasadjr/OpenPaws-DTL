const { prisma } = require('../config/prisma');

const buildDonorWhere = ({ search, donorType }) => {
  const where = {};

  if (donorType) {
    where.donor_type = donorType;
  }

  if (search) {
    const term = search.trim();

    if (term) {
      where.OR = [
        { full_name: { contains: term, mode: 'insensitive' } },
        { first_name: { contains: term, mode: 'insensitive' } },
        { last_name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
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

const getDonors = async (filters = {}) => {
  const { page, limit } = normalizePagination(filters.page, filters.limit);
  const where = buildDonorWhere(filters);

  const [total, data] = await Promise.all([
    prisma.donors.count({ where }),
    prisma.donors.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
    },
  };
};

const getDonorById = async (id) => {
  return prisma.donors.findUnique({
    where: { id },
  });
};

const getDonorByEmail = async (email) => {
  return prisma.donors.findUnique({
    where: { email },
  });
};

module.exports = {
  getDonors,
  getDonorById,
  getDonorByEmail,
};
