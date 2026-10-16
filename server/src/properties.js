import {pool} from './db.js';
import {PropertyService} from './property-service.js';

// One catalogue/service instance shares the existing PostgreSQL transaction pool.
export const propertyService=new PropertyService(pool);
