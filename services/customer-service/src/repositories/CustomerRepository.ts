import { ICustomer, Customer } from "../model/Customer";
import logger from "../../../../shared/utils/logger";

export class CustomerRepository {
  // Create customer
  async create(data: Partial<ICustomer>): Promise<ICustomer> {
    try {
      const customer = new Customer(data);
      return await customer.save();
    } catch (error) {
      logger.error("Error creating customer:", error);
      throw error;
    }
  }

  // Find customer by Id
  async findById(id: string): Promise<ICustomer | null> {
    try {
      return await Customer.findById(id);
    } catch (error) {
      logger.error("Error finding customer by ID:", error);
      throw error;
    }
  }

  // Find customer by email
  async findByEmail(email: string): Promise<ICustomer | null> {
    try {
      return await Customer.findOne({ email });
    } catch (error) {
      logger.error("Error finding customer by email:", error);
      throw error;
    }
  }

  //   Find all customers
  async findAll(): Promise<ICustomer[]> {
    try {
      return await Customer.find({});
    } catch (error) {
      logger.error("Error finding all customers:", error);
      throw error;
    }
  }

  async update(
    id: string,
    data: Partial<ICustomer>,
  ): Promise<ICustomer | null> {
    try {
      return await Customer.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      logger.error("Error updating customer:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await Customer.findByIdAndDelete(id);
      return result !== null;
    } catch (error) {
      logger.error("Error deleting customer:", error);
      throw error;
    }
  }

  //   Seed default customer into the DB

  async seedDefaultCustomer(): Promise<void> {
    try {
      const existing = await this.findByEmail("john.doe@example.com");
      if (!existing) {
        await this.create({
          name: "John Doe",
          email: "john.doe@example.com",
        });
        logger.info("Default customer seeded");
      }
    } catch (error) {
      logger.error("Error seeding default customer:", error);
    }
  }
}
