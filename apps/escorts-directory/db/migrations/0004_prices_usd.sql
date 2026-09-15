UPDATE escort_profiles SET currency = 'USD' WHERE currency IS NULL OR currency = '' OR currency = 'ARS';
