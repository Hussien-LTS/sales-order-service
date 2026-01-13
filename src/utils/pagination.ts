export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResponse<T> {
  results: T[];
  pagination: {
    total: number;
    pages: number;
    current: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
}

export function getPaginationParams(
  pageParam: string | string[] | undefined,
  limitParam: string | string[] | undefined
): PaginationParams {
  const page = typeof pageParam === "string" ? parseInt(pageParam) : 1;
  const limit = typeof limitParam === "string" ? parseInt(limitParam) : 10;

  const pageNum = Math.max(1, isNaN(page) ? 1 : page);
  const limitNum = Math.max(1, Math.min(50, isNaN(limit) ? 10 : limit)); // Max 50

  const skip = (pageNum - 1) * limitNum;

  return {
    page: pageNum,
    limit: limitNum,
    skip: skip,
  };
}

export function getPagingData<T>(
  data: { count: number; rows: T[] },
  page: number,
  limit: number
): PaginationResponse<T> {
  const { count: total, rows: results } = data;
  const totalPages = Math.ceil(total / limit);

  return {
    pagination: {
      total,
      pages: totalPages,
      current: page,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      limit,
    },
    results,
  };
}
