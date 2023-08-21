import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';

function Admin() {
    const [transactions, setTransactions] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [number, setNumber] = useState('');
    const navigate = useNavigate();

    const specificUserId = '4e24e5ce-23ce-40d2-bf93-f12273e1b746';

    useEffect(() => {
        checkUser();
        fetchTransactions();
        fetchUsers();

        const subscription = supabase
            .channel('any')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchTransactions)
            .subscribe()



        return () => subscription.unsubscribe();
    }, []);



    async function checkUser() {
        try {
            const { data, error } = await supabase.auth.getUser();
            if (!data || data.user.id !== specificUserId) {
                navigate('/');
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };

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
            .in('type', ['spend', 'invite', 'refer'])
            .order('created_at', { ascending: false })

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

    async function handleConfirm(transaction) {
        console.log("Transaction ID:", transaction.id);
        const transactionId = transaction.id;
        const finalBill = transaction.bill_value - transaction.amount;

        // Update the transaction with is_confirmed = true
        const updateResponse = await supabase
            .from('transactions')
            .update({ is_confirmed: true })
            .eq('id', transactionId);

        console.log("Update Response:", updateResponse);

        if (updateResponse.error) {
            console.error("Error updating offer:", updateResponse.error);
            return; // Handle error appropriately
        }

        if (updateResponse.data === null) {
            console.warn("No matching transaction found to update. Check the transaction ID.");
        }
        // If Final bill is not 0, add another transaction with type=earn, and amount = final bill * 0.2, is_confirmed = true
        if (finalBill !== 0) {
            await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: transaction.user_id,
                        type: 'earn',
                        amount: (finalBill * 0.1).toFixed(2),
                        is_confirmed: true
                    },
                ]);
            const newBal = (finalBill * 0.1);
            const { data, error } = await supabase
                .rpc('update_balance', { uid: transaction.user_id, change: newBal });;
        }

        // If the transaction type is invite, then set the user to is_activated in users table
        if (transaction.type === 'invite') {
            const userId = transaction.user_id;
            await supabase
                .from('users')
                .upsert({ is_activated: true })
                .eq('user_id', userId).single();

            await supabase
                .from('offers')
                .upsert({ is_used: true })
                .eq('id', transaction.offer_id)

            await supabase
                .from('offers')
                .upsert({ is_unlocked: true })
                .eq('id', transaction.ref_offer_id)
        }

        // Fetch updated transactions
        fetchTransactions();
    };



    function BillBox(transaction) {
        return (<div className='bill-box'>
            <div className='wallet-balance'>
                <h2>Total Bill</h2>
                <h2>₹{parseFloat(transaction.bill_value).toFixed(2)}</h2>
            </div>
            {transaction.type === 'spend' && <div className='wallet-balance'><p>Discount from balance</p><p>-₹{transaction.amount.toFixed(2)}</p></div>}
            {transaction.type === 'invite' && <div className='wallet-balance'><p>Offers Applied</p><p>{`${transaction.type}`}</p></div>}
            {transaction.type === 'refer' && <div className='wallet-balance'><p>Offers Applied</p><p>{`${transaction.type}`}</p></div>}

            <div className='wallet-balance'>
                <h1>Final Bill</h1>
                <h1>₹{(transaction.bill_value - transaction.amount).toFixed(2)}</h1>
            </div>

            <div className='stack-h-fill' style={{ justifyContent: 'space-between', width: '100%' }}>   <button className='secondary-button' >Cancel</button>

                <button className='scanner' onClick={() => handleConfirm(transaction)} >Confirm</button>

            </div>

        </div>);

    };



    return (
        <div className='styled-container'>
            <div className='navbar'>
                {/* Add additional content if needed */}
            </div>

            <div className='hero-card'>
                <QRCode value={number} />
            </div>
            <input className='bill-input' placeholder='Enter bill amount' type="number" value={number} onChange={e => setNumber(e.target.value)} />

            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        {!transaction.is_confirmed ? BillBox(transaction) : <div className='list-item' >
                            <div className='wallet-balance'>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    {usersMap[transaction.user_id] && (
                                        <>
                                            <div style={{ backgroundColor: '#fff', borderRadius: '100px', border: '2px solid #000' }}>
                                                <p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}>
                                                    {transaction.type == 'earn' ? '₹' : transaction.type == 'refer' || transaction.type == 'invite' ? '🥤' : '₹'}</p>
                                            </div> <div>
                                                <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{usersMap[transaction.user_id].full_name + ` (${transaction.type})`}</p>
                                                <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{`+ ₹${transaction.bill_value}`}</p>
                                    <p>{` ﹣₹${transaction.amount}`}</p>

                                </div>

                            </div>
                        </div>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Admin;
