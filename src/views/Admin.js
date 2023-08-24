import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { Scanner } from '@codesaursx/react-scanner';

function BillBox({ code, customer, number, setCustomer, setCode, setNumber, clearState, fetchTransactions }) {
    const type = code.split('&')[1].split('%')[0];
    const uid = code.split('&')[0];
    const offerId = code.split('%')[1];
    const [offerName, setOfferName] = useState('');
    let discount = type === 'spend' ? Math.min(customer?.balance, number) : 0;
    let finalBill = Math.max(0, number - discount);

    useEffect(() => {
        supabase.from('users').select('*').eq('user_id', uid).single().then(({ data }) => {
            setCustomer(data);
        });

        if (type === 'refer' || type === 'invite') {
            supabase.from('offers').select('name').eq('id', offerId).single().then(({ data }) => {
                setOfferName(data.name);
            });
        }
    }, [code, customer, number]);

    async function handleConfirm(type, uid, offerId, billValue, finalBill) {

        if (type === 'spend') {


            await supabase.from('transactions').insert([
                {
                    user_id: customer.user_id,
                    offer_id: offerId,
                    type: 'spend',
                    amount: discount,
                    bill_value: billValue,
                    is_confirmed: true,
                },
            ]);



        } else if (type === 'refer' || type === 'invite') {
            const { data: offer } = await supabase
                .from('offers')
                .select('*')
                .eq('id', offerId)
                .single();

            await supabase.from('transactions').insert([
                {
                    user_id: customer.user_id,
                    offer_id: offerId,
                    type: type,
                    amount: -offer.value,
                    bill_value: billValue,
                    is_confirmed: true,
                },
            ]);

            await supabase
                .from('offers')
                .update({ is_used: true })
                .eq('id', offerId);

            if (type === 'invite') {
                await supabase
                    .from('offers')
                    .update({ is_unlocked: true })
                    .eq('id', offer.referral_uid);

                await supabase
                    .from('users')
                    .update({ is_activated: true })
                    .eq('user_id', customer.user_id);
            }
        }

        if (finalBill !== 0) {
            const cashback = Number((finalBill * 0.1).toFixed(2));

            const discount = Math.min(customer?.balance || 0, billValue);
            await supabase.from('transactions').insert([
                {
                    user_id: uid,
                    offer_id: offerId,
                    type: 'earn',
                    amount: cashback,
                    bill_value: finalBill,
                    is_confirmed: true,
                },
            ]);

            await supabase
                .from('users')
                .update({ balance: (customer.balance || 0) + cashback - discount })
                .eq('user_id', customer.user_id);
        }

        clearState();
        fetchTransactions();
    };



    function clearState() {
        setNumber(null)
        setCode(null)
        setCustomer(null)
        setOfferName(null)
    }

    function handleCancel() {
        clearState()
    }


    return (
        <div className='bill-box'>
            <div className='wallet-balance'>

                <input className='bill-input' placeholder='Enter bill amount' type="number" value={number ? number : ''} onChange={e => setNumber(e.target.value)} />
            </div>
            {type == 'spend' && <div className='wallet-balance'><p>{`Discount from balance (₹${customer?.balance})`}</p><p>-₹{Math.abs(discount.toFixed(2))}</p></div>}
            {type === 'invite' && <div className='wallet-balance'><p>Offers Applied</p><p>{`${offerName} (${type})`}</p></div>}
            {type === 'refer' && <div className='wallet-balance'><p>Offers Applied</p><p>{`${offerName} (${type})`}</p></div>}
            <div className='wallet-balance'>
                <h1>Final Bill</h1>
                <h1>₹{finalBill.toFixed(2)}</h1>
            </div>
            <div className='stack-h-fill' style={{ justifyContent: 'space-between', width: '100%' }}>
                <button className='secondary-button' onClick={handleCancel}>Cancel</button>
                <button className='scanner' disabled={!number} onClick={() => handleConfirm(type, uid, offerId, number, finalBill)}>Confirm</button>
            </div>
        </div>
    );
}


function Admin() {
    const [transactions, setTransactions] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [number, setNumber] = useState(0.00);
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [customer, setCustomer] = useState(null);
    const [offerName, setOfferName] = useState('');
    const [isScannerVisible, setScannerVisible] = useState(false);
    const specificUserId = '5bc347c2-3490-40e7-84c2-f941df26157e';

    useEffect(() => {
        checkUser();
        fetchTransactions();
        fetchUsers();

        const subscription = supabase
            .channel('any')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchTransactions)
            .subscribe();

        return () => subscription.unsubscribe();
    }, []);

    const toggleScanner = () => {
        setScannerVisible(!isScannerVisible);
    };

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
            .order('created_at', { ascending: false });

        if (data) {
            setTransactions(data);
        }
        if (error) {
            console.error('Error fetching transactions:', error);
        }
    }




    return (
        <div className='styled-container'>



            {isScannerVisible ? (
                <div className="scanner-modal">
                    <button className='secondary-button close-button' onClick={toggleScanner}>Cancel</button>
                    <Scanner width="100%" height="100%" onUpdate={(e, data) => data && (setCode(data.getText()), toggleScanner())} />
                </div>
            ) : ''}

            {!code && !isScannerVisible && <div className='wallet-balance' style={{ alignItems: 'center' }}><h2> Transaction history </h2><button className='secondary-button' onClick={toggleScanner}>Scan</button></div>}

            {code ? <BillBox code={code} customer={customer} number={number} setNumber={setNumber} setCustomer={setCustomer} setCode={setCode} fetchTransactions={fetchTransactions} /> : ''}

            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        {<div className='list-item' >
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
                                    <p>{` ﹣₹${Math.abs(transaction.amount)}`}</p>

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
