import { createConfig } from '../../../../shared/utils/config';

export const config = createConfig({
  port: 5002,
  serviceName: 'product-service',
  extra: {
    stockReservationTimeout: parseInt(process.env.STOCK_RESERVATION_TIMEOUT || '60000'),
  },
});
