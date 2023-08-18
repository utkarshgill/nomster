import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import svgData from './svgData';

import { Scanner } from '@codesaursx/react-scanner';

function Admin() {
    const [code, setCode] = useState('');
    const [isScannerVisible, setScannerVisible] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const navigate = useNavigate();

    const specificUserId = '4e24e5ce-23ce-40d2-bf93-f12273e1b746'; // Replace with the actual user ID you want to allow

    // Function to toggle the visibility of the scanner modal
    const toggleScanner = () => {
        setScannerVisible(!isScannerVisible);
    };

    useEffect(() => {
        // Check user authentication status
        const checkUser = async () => {
            try {
                const { data, error } = await supabase.auth.getUser();
                console.log(data.user.id);
                if (!data.user || data.user.id !== specificUserId) {
                    navigate('/'); // Redirect to a different page if not authorized
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        checkUser();
        fetchTransactions();
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const { data: usersData, error } = await supabase
                .from('users')
                .select('*');

            if (usersData) {
                const usersMap = {};
                usersData.forEach((user) => {
                    usersMap[user.user_id] = user;
                });
                setUsersMap(usersMap);
            }
            if (error) {
                console.error('Error fetching users:', error);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const renderTransactionAmount = (transaction) => {
        const formattedAmount = Math.abs(transaction.amount).toFixed(2);
        return (
            <span style={{ color: transaction.amount < 0 ? 'grey' : 'green', fontWeight: 'bold' }}>
                {transaction.amount < 0 ? `- ₹${formattedAmount}` : `+ ₹${formattedAmount}`}
            </span>
        );
    };

    async function fetchTransactions() {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('brand_id', specificUserId)
            .order('created_at', { ascending: false });
        if (data) {
            setTransactions(data);
        }
        if (error) {
            console.error('Error fetching transactions:', error);
        }
    }
    const handleListItemNavigation = (transaction) => {
        navigate(`/billing?offerId=${transaction.offer_id}`);
    }
    return (
        <div className='styled-container'><div className="styled-container"><div className='navbar'><div dangerouslySetInnerHTML={{ __html: svgData.nomster }} />
        </div> </div>
            {/* Button to toggle the visibility of the scanner */}
            {isScannerVisible && (
                <div className="scanner-modal">
                    <div className='bounding-box' />

                    <Scanner
                        width="100%" // Make it full screen
                        height="100%" // Make it full screen
                        onUpdate={(e, data) => {
                            if (data) {
                                console.log(data);
                                setCode(data.getText());
                                toggleScanner();
                                const offerId = data.getText();
                                navigate(`/billing?offerId=${offerId}`);
                            }
                        }}
                    />
                </div>
            )}
            <button className='scanner' onClick={toggleScanner}>
                {!isScannerVisible ? 'Open camera' : 'Close'}
            </button>
            <p>{code}</p>
            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        <div className='list-item' onClick={() => handleListItemNavigation(transaction)}>
                            <div className='wallet-balance'>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    {usersMap[transaction.user_id] && (
                                        <>
                                            <img className='profile-pic' src={usersMap[transaction.user_id].avatar_url} alt={usersMap[transaction.user_id].full_name} />
                                            <div>
                                                <p>{usersMap[transaction.user_id].full_name}{transaction.amount < 0 ? ' redeemed' : ' earned'}</p>
                                                <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <p>{renderTransactionAmount(transaction)}</p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Conditionally render the scanner modal based on visibility */}

        </div>
    );
}

export default Admin;
