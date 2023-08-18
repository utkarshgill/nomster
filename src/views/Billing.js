import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import QRCodeCanvas from 'qrcode.react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

function Billing() {
    const [user, setUser] = useState(null);
    const [offer, setOffer] = useState(null);
    const [offerType, setOfferType] = useState(null);
    const [billAmount, setBillAmount] = useState('');
    const [finalBill, setFinalBill] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const navigate = useNavigate();

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const offerId = queryParams.get('offerId');

    const handleRecordUpdated = async (event) => {
        if (event.new) {
            console.log('event happened: ' + event);
            setOffer(event.new);
        }
    }

    useEffect(() => {

        fetchUserData();
        fetchTransactions();
        const subscription = supabase
            .channel(`any`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'offers', filter: `id=eq.${offerId}` }, handleRecordUpdated)
            .subscribe();
        return () => {
            subscription.unsubscribe();
        };
    }, [offerId]);



    async function fetchOfferType(type) {
        try {
            const { data } = await supabase
                .from('offer_types')
                .select('*')
                .eq('type', type)
                .single();
            if (data) {
                setOfferType(data);
            }
        } catch (error) {
            console.error('Error fetching offer data:', error);
        }
    }

    async function fetchUserData() {
        try {
            const { data: offerData } = await supabase
                .from('offers')
                .select('*')
                .eq('id', offerId)
                .single();
            if (offerData) {
                console.log(offerData);
                setOffer(offerData);
                fetchOfferType(offerData.type);
                const { data: userData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', offerData.user_id)
                    .single();
                if (userData) {
                    setUser(userData);
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }



    async function fetchTransactions() {
        if (user) {
            console.log('user is: ' + user);
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.user_id) // Changed this line
                .order('created_at', { ascending: false });
            if (data) {
                setTransactions(data);
            }
            if (error) {
                console.error('Error fetching transactions:', error);
            }
        }
    }

    useEffect(() => {


        fetchTransactions();
    }, [user]);



    useEffect(() => {
        if (user && billAmount !== '' && offer && offerType) {
            if (offer.type !== 'invite' || parseFloat(billAmount) >= parseFloat(offerType.min_value)) {
                const walletBalance = parseFloat(offer.value);
                let calculatedFinalBill = parseFloat(billAmount) - walletBalance;

                if (offer.type === 'loyal') {
                    calculatedFinalBill = isNaN(calculatedFinalBill) ? parseFloat(billAmount) : calculatedFinalBill;
                    calculatedFinalBill = calculatedFinalBill < 0 ? 0 : calculatedFinalBill;
                } else {
                    calculatedFinalBill = isNaN(calculatedFinalBill) ? parseFloat(billAmount) : calculatedFinalBill;
                }

                setFinalBill(calculatedFinalBill);

                const calculatedDiscount = Math.min(parseFloat(billAmount), walletBalance);
                setDiscount(isNaN(calculatedDiscount) ? 0 : calculatedDiscount);
            } else {
                setFinalBill(parseFloat(billAmount) || 0);
                setDiscount(0);
            }
        } else {
            setFinalBill(parseFloat(billAmount) || 0);
            setDiscount(0);
        }
    }, [billAmount, user, offerType, offer]);



    const handleConfirm = async () => {
        if (user && offer) {
            try {
                if (offer.type === 'loyal') {
                    const loyaltyReward = finalBill * 0.2;
                    const spentAmount = -discount;
                    let updatedBalance = parseFloat(offer.value) + spentAmount + loyaltyReward;
                    if (spentAmount) {
                        const transactionSpend = {
                            user_id: offer.user_id,
                            offer_id: offerId,
                            brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                            type: 'spend',
                            amount: spentAmount,
                            bill_value: billAmount
                        };
                        await supabase.from('transactions').upsert([transactionSpend]);
                    }
                    if (loyaltyReward) {
                        const transactionEarn = {
                            user_id: offer.user_id,
                            offer_id: offerId,
                            brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                            type: 'earn',
                            amount: loyaltyReward,
                            bill_value: finalBill
                        };
                        await supabase.from('transactions').upsert([transactionEarn]);
                    }
                    // Updating the offer value in the 'offers' table
                    console.log('Updating offer with ID:', offerId);
                    console.log('Updated balance:', updatedBalance);

                    const { data, error } = await supabase
                        .from('offers')
                        .upsert({ id: offerId, value: updatedBalance })
                        .select();

                    if (error) {
                        console.error('Error updating offer value:', error);
                    } else if (data && data.length > 0) {
                        console.log('Offer updated:', data);
                        setOffer({ ...offer, value: updatedBalance }); // Updating the local state
                    } else {
                        console.log('No matching offer found for ID:', offerId);
                    }
                } else if (offer.type === 'invite') {
                    if (parseFloat(billAmount) >= offerType.min_value) {
                        const transactionInvite = {
                            user_id: offer.user_id,
                            offer_id: offerId,
                            brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                            type: 'invite',
                            amount: -offerType.value,
                            bill_value: billAmount
                        };
                        await supabase.from('transactions').upsert([transactionInvite]);

                        const transactionEarn = {
                            user_id: offer.user_id,
                            offer_id: offerId,
                            brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                            type: 'earn',
                            amount: 0.2 * parseFloat(billAmount),
                            bill_value: billAmount
                        };
                        await supabase.from('transactions').upsert([transactionEarn]);

                        await supabase.from('users').upsert({ user_id: offer.user_id, is_activated: true });
                        await supabase.from('offers').upsert({ id: offerId, is_used: true });
                        await supabase.from('offers').upsert({ id: offer.referral_uid, is_unlocked: true });
                    }
                } else if (offer.type === 'refer') {

                    const transactionRefer = {
                        user_id: offer.user_id,
                        offer_id: offerId,
                        brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                        type: 'refer',
                        amount: -offerType.value,
                        bill_value: billAmount
                    };
                    await supabase.from('transactions').upsert([transactionRefer]);
                    if (parseFloat(billAmount) > 0) {
                        const transaction = {
                            user_id: offer.user_id,
                            offer_id: offerId,
                            brand_id: '4e24e5ce-23ce-40d2-bf93-f12273e1b746',
                            type: 'earn',
                            amount: 0.2 * parseFloat(billAmount),
                            bill_value: billAmount
                        };
                        await supabase.from('transactions').upsert([transaction]);
                        await supabase.from('offers').upsert({ id: offerId, is_used: true });
                    }
                }
                setBillAmount(''); fetchTransactions();
            } catch (error) {
                console.error('Error confirming the bill:', error);
            }
        }
    };




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

    const renderBillBox = () => {
        return <div>

            {offer && offerType ? (
                <div className='wallet-balance'>
                    <p>{offer.type === 'loyal' ? `Pay using loyalty balance` : 'Offer applied'}</p>
                    <p>{offer.type === 'loyal' ? (discount ? `-₹${discount.toFixed(2)}` : '₹0.00') : `${offerType.name} ${offer.type === 'invite' || 'refer' ? `(worth ₹${offerType.value})` : ''}`}</p>
                </div>
            ) : ''}
            <div className='wallet-balance'>
                <h1>Total</h1>
                <h1>₹{finalBill.toFixed(2)}</h1>
            </div>
            {offerType && offer.type === 'invite' || 'refer' && parseFloat(billAmount) < parseFloat(offerType.min_value) && (
                <p className='cute-message'>Min value ₹{offerType.min_value} is required</p>
            )}
            <div className='billing-navbar'>
                <input className='bill-input'
                    type="number"
                    placeholder="Enter bill amount"
                    value={billAmount}
                    onChange={(e) => {
                        if (e.target.value >= 0) setBillAmount(e.target.value)
                    }}
                    min={offerType && offerType.type === 'invite' || 'refer' ? offerType.min_value : 0}
                />

                <button className='scanner' onClick={handleConfirm} disabled={isConfirmDisabled()}>
                    Confirm
                </button>
            </div>
        </div>
    }

    const renderCard = (offer, user) => {
        // if (offer.is_used) return null;
        const backgroundImage = `url('https://source.unsplash.com/random')`;

        switch (offer.type) {
            case 'loyal':
                return (<div style={{ width: '100%' }}>
                    <div className="offer-card" style={{ backgroundImage }}>

                        {/* <img src={user.avatar_url} className='profile-pic' alt={user.full_name} />
                        <p>{user.full_name}</p> */}
                        <h1>{offer.value !== null ? `₹${offer.value.toFixed(2)}` : ''}</h1>
                    </div>
                    {renderBillBox()}
                </div>

                );
            case 'invite':
                return (<div style={{ width: '100%' }}>
                    <div className="offer-card" style={{ backgroundImage }}>

                        <p>{offer.type} {offerType ? `(${offerType.value})` : ''}</p>
                        {/* <QRCodeCanvas className="qr-code" size={720} value={offer.id} includeMargin /> */}
                    </div>{renderBillBox()}
                </div>
                );
            case 'refer':
                return (<div style={{ width: '100%' }}>
                    <div className="offer-card" style={{ backgroundImage }}>

                        <p>{offer.type} {offerType ? `(${offerType.value})` : ''}</p>
                        {/* <QRCodeCanvas className="qr-code" size={720} value={offer.id} includeMargin /> */}
                    </div>{renderBillBox()}
                </div>
                );
            default:
                return <div style={{ width: '100%' }} >Error</div>;
        }
    };

    const isConfirmDisabled = () => {
        if (billAmount === '' || billAmount <= 0) return true;
        if (offerType && offer.type === 'invite' || 'refer' && parseFloat(billAmount) < parseFloat(offerType.min_value)) return true;
        return false;
    };

    return (

        <div className='styled-container'>



            {user && (

                <div className='billing-navbar'>


                    <button className='secondary-button' onClick={() => navigate('/admin')}>◀ Back</button>
                    <div className='wallet-balance' style={{ width: 'fit-content', alignItems: 'center', gap: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                        <p>{user.full_name}</p> <img src={user.avatar_url} className='profile-pic' alt={user.full_name} />

                    </div>
                </div>



            )}

            {offer && user ? renderCard(offer, user) : ''}


            {/* Disable confirm button for empty input */}



            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        <div className='list-item'  >
                            <div className='wallet-balance'>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ backgroundColor: '#eee', borderRadius: '100px' }}><p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}> {transaction.type == 'earn' ? '↑' : transaction.type == 'refer' ? '🥤' : transaction.type == 'invite' ? '🥤' : '↓'}</p>
                                    </div> <div><p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{transaction.type}</p> <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                    </div>
                                </div>
                                <p>{renderTransactionAmount(transaction)}</p></div>


                        </div>
                    </li>
                ))}
            </ul>
        </div >
    );
}

export default Billing;
