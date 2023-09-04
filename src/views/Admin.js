import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { Scanner } from '@codesaursx/react-scanner';



function Admin() {
    const [transactions, setTransactions] = useState([]);
    const [usersMap, setUsersMap] = useState({});
    const navigate = useNavigate();
    const [code, setCode] = useState('&%');
    const [customer, setCustomer] = useState(null);
    const [offerName, setOfferName] = useState('');
    const [isScannerVisible, setScannerVisible] = useState(false);





    //bill box related state
    // const type = code.split('&')[1].split('%')[0];
    // const uid = code.split('&')[0];
    // const offerId = code.split('%')[1];

    // const discount = type === 'spend' ? Math.min(customer?.balance ?? 0, number) : 0;
    // const finalBill = Math.max(0, number - discount);
    // const cashback = Number((finalBill * 0.1).toFixed(2));

    // useEffect(() => {
    //     console.log(uid);
    //     if (uid) {
    //         supabase.from('users').select('*').eq('user_id', uid).single().then(({ data }) => {
    //             if (data) {
    //                 setCustomer(data);
    //             } else {
    //                 console.error('Failed to fetch user data');
    //             }
    //         })
    //     }
    //     ;


    //     if (type === 'refer' || type === 'invite') {
    //         supabase.from('offers').select('name').eq('id', offerId).single().then(({ data }) => {
    //             setOfferName(data.name);
    //         });
    //     }

    // }, [code]);

    async function handleConfirm(transaction) {
        // if (!customer) {
        //     console.error('Customer is null');
        //     return;
        // }
        const finalBill = transaction.bill_value - (transaction.type == 'spend' ? transaction.amount : 0);
        // console.log(uid);
        console.log('here');

        const { data, error } = await supabase.from('transactions').update(
            {
                is_confirmed: true,
            },
        ).eq('id', transaction.id).select();

        console.log(data);





        if (transaction.type === 'refer') {




            await supabase
                .from('offers')
                .update({ is_used: true })
                .eq('id', transaction.offer_id);




        } else if (transaction.type === 'invite') {
            await supabase
                .from('offers')
                .update({ is_used: true })
                .eq('id', transaction.offer_id);

            await supabase
                .from('offers')
                .update({ is_unlocked: true })
                .eq('id', transaction.ref_offer_id)






        }


        if (finalBill) {

            await supabase
                .from('users')
                .update({ is_activated: true })
                .eq('user_id', transaction.user_id);



        }


        const deltaBal = (0.1 * (finalBill) - (transaction.type == 'spend' ? transaction.amount : 0)).toFixed(2)
        await supabase.rpc('update_balance', { uid: transaction.user_id, change: deltaBal })

        // await supabase
        //     .from('users')
        //     .update({ balance: (customer.balance || 0) + cashback - discount })
        //     .eq('user_id', customer.user_id);



        clearState();
        fetchTransactions();
    };



    function clearState() {
        setCode('&%')
        setCustomer(null)
        setOfferName(null)
    }

    async function handleCancel(transaction) {
        await supabase.from('transactions').delete().eq('id', transaction.id);
        clearState()
        fetchTransactions();
    }
    const specificUserId = '5bc347c2-3490-40e7-84c2-f941df26157e';

    // const specificUserId = 'b41a7008-c0fd-419a-96e7-e9e0e8efb5c5';

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
                .eq('brand_id', '5bc347c2-3490-40e7-84c2-f941df26157e')
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

                const { data, error, status } = await supabase
                    .from('users')
                    .select();

                console.log('HTTP Status:', status);  // Debug Point 2: Log HTTP Status
                console.log('Supabase Error:', error);  // Debug Point 2: Log any errors


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
        const options = {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return new Date(dateString).toLocaleString(undefined, options);
    };

    function TransactionItem({ transaction, handleConfirm }) {

        return (
            <li key={transaction.id} style={{ listStyleType: 'none' }}>
                {!transaction.is_confirmed ?
                    <div className='bill-box' >
                        <div className='wallet-balance'>
                            <h1>To Pay</h1>
                            <h1> {transaction.bill_value.toFixed(2)} </h1>
                        </div>


                        {transaction.type == 'spend' ? <div className='wallet-balance'><p>{`Discount from balance`}</p><p>-₹{transaction.amount.toFixed(2)}</p></div> : ''}
                        {transaction.type == 'refer' || transaction.type == 'invite' ? <div className='wallet-balance'><p>Offers Applied</p><p>{`${transaction.type} (worth ₹${Math.abs(transaction.amount)})`}</p></div> : ''}

                        <div className='wallet-balance'>
                            <p>To Pay</p>
                            <p>₹{(transaction.type == 'spend' ? (transaction.bill_value - transaction.amount) : transaction.bill_value).toFixed(2)}</p>
                        </div>
                        <div className='wallet-balance'><p>{`Cashback`}</p><p>₹{((transaction.bill_value - (transaction.type == 'spend' ? transaction.amount : 0)) * .1).toFixed(2)}</p></div>

                        <div className='stack-h-fill' style={{ justifyContent: 'space-between', width: '100%', gap: '20px' }}>
                            <button className='secondary-button' onClick={() => handleCancel(transaction)}>Reject</button>
                            <button className='scanner' onClick={() => handleConfirm(transaction)}>Approve</button>
                        </div>
                    </div>

                    :



                    <div className='list-item' >
                        <div className='wallet-balance'>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                {usersMap[transaction.user_id] && (
                                    <>
                                        <div style={{ backgroundColor: '#fff', borderRadius: '100px' }}>
                                            <p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}>
                                                {transaction.type == 'earn' ? '₹' : transaction.type == 'refer' || transaction.type == 'invite' ? '🥤' : '₹'}</p>
                                        </div> <div>
                                            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{usersMap[transaction.user_id].full_name}</p>
                                            <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{`+ ₹${transaction.bill_value.toFixed(2)}`}</p>
                                <p>{`(${transaction.type}) ﹣₹${transaction.amount.toFixed(2)}`}</p>

                                <p>{`₹${(0.1 * (transaction.bill_value - (transaction.type == 'spend' ? transaction.amount : 0))).toFixed(2)} cashback`}</p>
                            </div>

                        </div>
                    </div>}
            </li>
        );
    }





    return (

        <div className='styled-container'>
            <h1 style={{ textAlign: 'center', width: '100%', marginTop: '60px' }}>Transactions</h1>





            <ul className='list'>
                {transactions.map((transaction) => (


                    <TransactionItem key={transaction.id} transaction={transaction} handleConfirm={handleConfirm} />



                ))}
            </ul>
        </div>
    );
}

export default Admin;
