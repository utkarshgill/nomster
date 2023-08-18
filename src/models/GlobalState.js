import React, { createContext, useContext, useState } from 'react';

export const StatusContext = createContext();

export const useStatus = () => useContext(StatusContext);

export const StatusProvider = ({ children }) => {
    const [status, setStatus] = useState('idle'); // 'idle', 'inserting', 'completed'
    return (
        <StatusContext.Provider value={{ status, setStatus }}>
            {children}
        </StatusContext.Provider>
    );
};
