import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface Customer {
  id: string;
  name: string;
}

interface CustomerSelectorProps {
  onCustomerChange: (customerId: string | null) => void;
}

export const CustomerSelector = ({ onCustomerChange }: CustomerSelectorProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/customers`);
        if (!response.ok) {
          throw new Error('Failed to load customers');
        }
        const data = await response.json();
        setCustomers(data.customers || []);
        
        // Load saved customer from localStorage, or default to "salesforce"
        const savedCustomer = localStorage.getItem('selectedCustomerId');
        let customerToSelect: Customer | undefined;
        
        // Use saved customer if it exists and is valid
        if (savedCustomer && data.customers.some((c: Customer) => c.id === savedCustomer)) {
          customerToSelect = data.customers.find((c: Customer) => c.id === savedCustomer);
        }
        
        // Default to "salesforce" if no valid saved customer
        if (!customerToSelect) {
          customerToSelect = data.customers.find((c: Customer) => c.id === 'salesforce') || data.customers[0];
          // Set default to salesforce in localStorage on first load
          if (customerToSelect) {
            localStorage.setItem('selectedCustomerId', customerToSelect.id);
          }
        }
        
        if (customerToSelect) {
          setSelectedCustomer(customerToSelect.id);
          onCustomerChange(customerToSelect.id);
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomers();
  }, [onCustomerChange]);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId);
    localStorage.setItem('selectedCustomerId', customerId);
    onCustomerChange(customerId);
  };

  if (isLoading) {
    return (
      <div className="px-3 py-1 text-sm text-gray-600">
        Loading customers...
      </div>
    );
  }

  if (customers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="customer-select" className="text-sm font-medium text-gray-700">
        Customer:
      </label>
      <select
        id="customer-select"
        value={selectedCustomer || ''}
        onChange={(e) => handleCustomerChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3] focus:border-transparent"
      >
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
    </div>
  );
};
