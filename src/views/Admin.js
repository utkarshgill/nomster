import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { Scanner } from '@codesaursx/react-scanner';



function Admin() {
    const [transactions, setTransactions] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const [number, setNumber] = useState(0.00);
    const navigate = useNavigate();
    const [code, setCode] = useState('&%');
    const [customer, setCustomer] = useState(null);
    const [offerName, setOfferName] = useState('');
    const [isScannerVisible, setScannerVisible] = useState(false);

    //bill box related state
    const type = code.split('&')[1].split('%')[0];
    const uid = code.split('&')[0];
    const offerId = code.split('%')[1];

    const discount = type === 'spend' ? Math.min(customer?.balance || 0, number) : 0;
    const finalBill = Math.max(0, number - discount);
    const cashback = Number((finalBill * 0.1).toFixed(2));

    useEffect(() => {
        console.log('HERE1');
        console.log(uid);
        if (uid) {
            supabase.from('users').select('*').eq('user_id', uid).single().then(({ data }) => {
                setCustomer(data);
            })
        }
        ;

        console.log('HERE2');

        if (type === 'refer' || type === 'invite') {
            supabase.from('offers').select('name').eq('id', offerId).single().then(({ data }) => {
                offerName = data.name;
            });
        }

        console.log('HEREX');
    }, [code, customer, number]);

    async function handleConfirm(type, uid, offerId, billValue) {
        console.log(uid);
        console.log(customer);


        if (type === 'spend') {


            await supabase.from('transactions').insert([
                {
                    user_id: uid,
                    offer_id: offerId == 'cardID' ? null : offerId,
                    type: 'spend',
                    amount: discount,
                    bill_value: billValue,
                    is_confirmed: true,
                },
            ]).select();





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
                    amount: -(offer.value),
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

            // const discount = Math.min(customer?.balance || 0, billValue);
            await supabase.from('transactions').insert([
                {
                    user_id: uid,
                    offer_id: offerId == 'cardID' ? null : offerId,
                    type: 'earn',
                    amount: cashback,
                    bill_value: finalBill,
                    is_confirmed: true,
                },
            ]);

            await supabase
                .from('users')
                .update({ is_activated: true })
                .eq('user_id', customer.user_id);


        }

        await supabase
            .from('users')
            .update({ balance: (customer.balance || 0) + cashback - discount })
            .eq('user_id', customer.user_id);



        clearState();
        fetchTransactions();
    };



    function clearState() {
        setNumber(null)
        setCode('&%')
        setCustomer(null)
        setOfferName(null)
    }

    function handleCancel() {
        clearState()
    }
    // const specificUserId = '5bc347c2-3490-40e7-84c2-f941df26157e';

    const specificUserId = '12f5ebba-abc3-4c12-9aee-cc7fd96fc817';

    useEffect(() => {
        checkUser();
        fetchTransactions();
        fetchUsers();

        const subscription = supabase
            .channel('any')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
                console.log('Change received!', payload)
                fetchTransactions();
            })
            .subscribe();

        return () => subscription.unsubscribe();
    }, []);

    async function fetchTransactions() {
        try {
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
        } catch (error) {
            console.error('Unexpected error:', error);
        }
    }

    const toggleScanner = () => {
        setScannerVisible(!isScannerVisible);
    };

    async function checkUser() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user.id !== specificUserId) {
                navigate('/');
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };

    async function fetchUsers() {
        try {

            const { data: { user } } = await supabase.auth.getUser() // Get the current user session
            console.log('User:', user);  // Debug Point 1: Log the user to ensure it's not null

            if (user) {
                console.log('HERE3');

                const { data, error, status } = await supabase
                    .from('users')
                    .select();

                console.log('HTTP Status:', status);  // Debug Point 2: Log HTTP Status
                console.log('Supabase Error:', error);  // Debug Point 2: Log any errors

                console.log('HERE4');

                if (data) {
                    console.log(data);

                    const usersMap = {};  // Initialize user map
                    data.forEach((user) => {
                        usersMap[user.user_id] = user;
                    });

                    setUsersMap(usersMap);  // Assume this is a React state setter
                }

                if (error) {
                    console.error('Error fetching users:', error);
                }
            }
        } catch (error) {
            console.error('Caught Exception:', error);
        }
    }



    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };



    const handleScan = async (e, data) => {


        if (data) {
            setCode(data.getText());
            toggleScanner();
            const uid = data.getText().split('&')[0];
            if (uid) {
                await supabase.from('users').select('*').eq('user_id', uid).single().then(({ userData }) => {
                    setCustomer(userData);
                });
            }


            if (type === 'refer' || type === 'invite') {
                await supabase.from('offers').select('name').eq('id', offerId).single().then(({ offerData }) => {
                    setOfferName(offerData.name);
                });
            }

        }

    }


    return (

        <div className='styled-container'>



            {isScannerVisible ? (
                <div className="scanner-modal">
                    <button className='secondary-button close-button' onClick={toggleScanner}>Cancel</button>
                    <Scanner width="100%" height="100%" onUpdate={handleScan} />
                </div>
            ) : ''}

            {code == '&%' && !isScannerVisible && <div className='wallet-balance' style={{ alignItems: 'center' }}><h2> Transaction history </h2><button className='secondary-button' onClick={toggleScanner}>Scan</button></div>}

            {code != '&%' ?

                <div className='bill-box'>
                    <div className='wallet-balance'>

                        <input className='bill-input' placeholder='Enter bill amount' type="number" value={number ? number : ''} onChange={e => setNumber(e.target.value)} />
                    </div>
                    {type == 'spend' && <div className='wallet-balance'><p>{`Discount from balance (₹${customer?.balance.toFixed(2)})`}</p><p>-₹{Math.abs(discount.toFixed(2))}</p></div>}
                    {type === 'invite' && <div className='wallet-balance'><p>Offers Applied</p><p>{`${offerName} (${type})`}</p></div>}
                    {type === 'refer' && <div className='wallet-balance'><p>Offers Applied</p><p>{`${offerName} (${type})`}</p></div>}
                    <div className='wallet-balance'>
                        <h1>Final Bill</h1>
                        <h1>₹{finalBill.toFixed(2)}</h1>
                    </div>
                    <div className='stack-h-fill' style={{ justifyContent: 'space-between', width: '100%' }}>
                        <button className='secondary-button' onClick={handleCancel}>Cancel</button>
                        <button className='scanner' disabled={!number} onClick={() => handleConfirm(type, uid, offerId, number)}>Confirm</button>
                    </div>
                </div>

                : ''}

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
