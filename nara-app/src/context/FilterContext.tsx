import React, { createContext, useContext, useState, useEffect } from "react";

interface FilterContextType {
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  clearRange: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [startDate, setStartDateState] = useState(() => localStorage.getItem("nara-arta-start-date") || "");
  const [endDate, setEndDateState] = useState(() => localStorage.getItem("nara-arta-end-date") || "");

  const setStartDate = (date: string) => {
    setStartDateState(date);
    localStorage.setItem("nara-arta-start-date", date);
  };

  const setEndDate = (date: string) => {
    setEndDateState(date);
    localStorage.setItem("nara-arta-end-date", date);
  };

  const clearRange = () => {
    setStartDateState("");
    setEndDateState("");
    localStorage.removeItem("nara-arta-start-date");
    localStorage.removeItem("nara-arta-end-date");
  };

  // Keep state synced with localStorage changes from other parts of the app, if any
  useEffect(() => {
    const handleStorageChange = () => {
      setStartDateState(localStorage.getItem("nara-arta-start-date") || "");
      setEndDateState(localStorage.getItem("nara-arta-end-date") || "");
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <FilterContext.Provider value={{ startDate, endDate, setStartDate, setEndDate, clearRange }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
};
