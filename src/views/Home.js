import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCodeCanvas from 'qrcode.react';
import mixpanel from 'mixpanel-browser';
import svgData from './svgData';
import './styles.scss';
import { useStatus } from '../models/GlobalState';

import { Scanner } from '@codesaursx/react-scanner';

function Home() {
    const navigate = useNavigate();
    const { offer: offerSVG, nomster: nomsterSVG, tcwLogo } = svgData;
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [offerCards, setOfferCards] = useState([]);
    const [isScannerVisible, setScannerVisible] = useState(false);
    const [code, setCode] = useState('');
    const [bill, setBill] = useState(null);

    const { status } = useStatus();

    const toggleScanner = () => {
        setScannerVisible(!isScannerVisible);
    };

    useEffect(() => {
        if (status === 'completed') {
            fetchOfferCards(user.user_id);
        }
    }, [user, status]);

    const handleCarouselScroll = () => {
        if (user) {
            mixpanel.track('scroll offer', { user_id: user.user_id });
            document.querySelector('.horizontal-scroll-container').removeEventListener('scroll', handleCarouselScroll);

        }
    };

    // useEffect(() => {
    //     const scrollContainer = document.querySelector('.horizontal-scroll-container');
    //     // scrollContainer.addEventListener('scroll', handleCarouselScroll);

    //     return () => {
    //         scrollContainer.removeEventListener('scroll', handleCarouselScroll);
    //     };
    // }, []);
    const fetchUser = async () => {
        console.log('Fetching user...'); // Debug log before fetching user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', user.id).single();
            console.log('User fetched:', userData); // Debug log for fetched user
            setUser(userData);
        } else {
            console.log('No user found, redirecting...'); // Debug log if no user is found
            navigate('/');
        }
    };

    useEffect(() => {

        fetchUser();
    }, []);

    useEffect(() => {
        if (user) {
            console.log('User state updated, creating subscriptions:', user); // Debug log for updated user state

            fetchOfferCards(user.user_id);
            fetchTransactions(user.user_id);
        }
    }, [user]);


    useEffect(() => {
        if (user) {
            console.log('Creating subscription for user:', user.user_id); // Debug log for subscription creation

            const filterString = `user_id=eq.${user.user_id}`;

            const subscription = supabase
                .channel('any')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: filterString }, handleTransactionUpdated)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: filterString }, handleOfferUpdated)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: filterString }, handleUserUpdated)
                .subscribe()

            console.log('Subscription created for user:', user.user_id);

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [user]);


    const handleUserUpdated = (event) => {
        if (event.new) {
            setUser(event.new);//
        }
    }


    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/');
        setUser(null);
    };



    const fetchTransactions = async (userId) => {
        const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data) setTransactions(data);
        if (error) console.error('Error fetching transactions:', error);
    };

    const handleTransactionUpdated = (event) => {
        console.log('new');
        if (user && event.new && ['INSERT', 'UPDATE'].includes(event.eventType)) fetchTransactions(user.user_id);
    };

    const handleOfferUpdated = async (event) => {
        console.log('Handling offer updated:', event); // Debug log to see what the event object contains

        if (event.eventType === 'INSERT') {
            fetchOfferCards(user.user_id);
            const { new: newOffer } = event;
            console.log('New offer:', newOffer); // Debug log for the new offer

            if (newOffer.referral_uid && user) {

                const { data: inviterDetails } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', user.invited_by)
                    .single();

                console.log(inviterDetails.full_name)
                newOffer.inviter = inviterDetails;


                console.log('New offer with inviter:', newOffer); // Debug log for the new offer with inviter details
            }

            setOfferCards(currentOfferCards => {
                console.log('Current offer cards:', currentOfferCards); // Debug log for the current offer cards before updating
                const updatedOfferCards = [...currentOfferCards, newOffer];
                console.log('Updated offer cards:', updatedOfferCards); // Debug log for the updated offer cards after adding the new offer
                return updatedOfferCards;
            });
        } else if (event.eventType === 'UPDATE') {
            fetchOfferCards(user.user_id);
        }
    };

    const fetchOfferCards = async (userId) => {
        if (user) {
            const { data, error } = await supabase
                .from('offers')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });


            if (data) {
                console.log(data);
                const offersWithInviterDetails = await Promise.all(
                    data.map(async offer => {
                        if (offer && user) {
                            if (offer.type == 'invite') {

                                console.log('here');
                                const { data: inviter, error } = await supabase
                                    .from('users')
                                    .select('*')
                                    .eq('user_id', user.invited_by)
                                    .single()

                                offer.inviter = inviter;
                            } else if (offer.type = 'refer') {
                                const { data: ref, error } = await supabase
                                    .from('users')
                                    .select('*')
                                    .eq('user_id', offer.referral_uid)
                                    .single()
                                offer.ref = ref;
                            }
                            return offer;
                        }

                    })
                );
                setOfferCards(offersWithInviterDetails);
            } else {
                setOfferCards([]);
            } if (error) {
                console.error('Error fetching offers:', error);
            }
        }



    };


    const updateOffers = (event) => {
        const { new: updatedOffer, eventType } = event;
        setOfferCards(currentOfferCards => {
            if (eventType === 'INSERT') return [...currentOfferCards, updatedOffer];
            if (eventType === 'UPDATE') return currentOfferCards.map(card => (card.id === updatedOffer.id ? { ...updatedOffer } : card));
            return [...currentOfferCards];
        });
    };


    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const renderTransactionAmount = (transaction) => (
        <span style={{ color: transaction.amount < 0 ? 'grey' : 'green', fontWeight: 'bold' }}>
            {transaction.amount < 0 ? `- ₹${Math.abs(transaction.amount).toFixed(2)}` : `+ ₹${Math.abs(transaction.amount).toFixed(2)}`}
        </span>
    );

    const handleShareOffer = () => {
        const referralUrl = `https://nomster.in/?i=${user.user_id}&o=invite`;
        const shareMessage = `Can't espresso how awesome you are, here's a *FREE* coffee for you 👉 ${referralUrl}`;

        mixpanel.track('tap share offer', { user_id: user.user_id });
        if (navigator.share) {
            navigator.share({ title: 'Invite Friends', text: shareMessage, url: referralUrl })
                .then(() => {
                    alert('Shared successfully!');
                    mixpanel.track('share offer successful', { user_id: user.user_id });
                })
                .catch(error => console.error('Error sharing:', error));
        }
    };




    const [discount, setDiscount] = useState(null);
    const [selectedOffer, setSelectedOffer] = useState(null);

    const renderCard = (card, index) => {
        if (card.is_used) return null;

        const imgUrl = card.type === 'invite' ? card.inviter?.avatar_url : card.ref?.avatar_url;
        const name = card.type === 'invite' ? card.inviter?.full_name : card.ref?.full_name;

        return (
            <div key={index} className="offer-card" style={card.type === 'refer' && !card.is_unlocked ? { filter: 'grayscale(1)' } : {}}>

                {
                    card.type === 'invite' || card.type === 'refer' ?
                        <label htmlFor={`offer-${index}`}>

                            <img style={{ width: '100%' }} src={card.image} />
                            <div className='stack-h-fill'>
                                <p>{card.type == 'invite' ? `${name} invited you` : `Because you invited ${name}`}</p>

                                <img style={{ borderRadius: '100px', width: '24px' }} src={imgUrl} alt="" />


                            </div>
                        </label> : ''
                }
            </div>
        );
    };

    const [useBalance, setUseBalance] = useState(false);

    const discountFromBalance = useBalance ? Math.min(parseFloat(bill), user?.balance ? parseFloat(user?.balance) : 0) : 0;
    const discountFromWallet = parseFloat(discount ? discount.toFixed(2) : 0);
    const totalBill = parseFloat(bill) - discountFromBalance - discountFromWallet;
    const finalBill = Math.max(totalBill, 0);

    const BalanceCard = () => (
        <div className="offer-card balance-card" style={bill ? { aspectRatio: 'auto' } : {}}>
            <div className='stack-h-fill'>
                <div>
                    <p>Balance</p>
                    <h1>{user?.balance !== null ? `₹${user?.balance?.toFixed(2)}` : ''}</h1>
                </div>
                <div>
                    {parseFloat(bill) !== 0 && user?.balance?.toFixed(2) != 0 &&
                        (useBalance ?
                            <div className='applied-offer'>✓ Applied</div> :
                            <button className='secondary-button' onClick={(e) => { setSelectedOffer(null); setUseBalance(true); }}>Use balance</button>)
                    }
                </div>
            </div>
        </div>
    );





    const BillBox = () => (
        <div className='bill-box'>
            <div className='wallet-balance'>
                <p>Total Bill</p>
                <p>₹{parseFloat(bill).toFixed(2)}</p>
            </div>
            {discountFromBalance > 0 && <div className='wallet-balance'><h2>You saved</h2><h2>-₹{discountFromBalance.toFixed(2)}</h2></div>}
            {selectedOffer && <div className='wallet-balance'><h2>{`Get a free drink! (worth ₹${selectedOffer.value})`}</h2></div>}
            <div className='wallet-balance'>
                <p>Final Bill</p>
                <p>₹{finalBill.toFixed(2)}</p>
            </div>
            <div className='stack-h-fill' style={{ width: '100%', justifyContent: 'space-between' }}>   <button className='secondary-button' onClick={() => setBill(null)}>Cancel</button>

                <button className='scanner' onClick={handleConfirm} disabled={isConfirmDisabled()}>Confirm</button>

            </div>

        </div>
    );

    const handleConfirm = async () => {
        // Transaction object to be added
        let transaction = {
            is_confirmed: false,
            bill_value: parseFloat(bill).toFixed(2),
            amount: parseFloat(discountFromBalance).toFixed(2),
            type: 'spend',
            offer_id: selectedOffer ? selectedOffer.id : undefined,
            ref_offer_id: selectedOffer && selectedOffer.type == 'invite' ? selectedOffer.referral_uid : ''

        };

        // If offer was used
        if (selectedOffer) {

            transaction.type = selectedOffer.type;
            transaction.amount = selectedOffer.value;
            // Update the offer to 'is_used' = true
            const updateResponse = await supabase
                .from('offers')
                .update({ is_used: true })
                .eq('id', selectedOffer.id);

            if (updateResponse.error) {
                console.error("Error updating offer:", updateResponse.error);
                return; // Handle error appropriately
            }
        }



        // Add the transaction to the transactions table
        const insertResponse = await supabase
            .from('transactions')
            .insert([transaction]);

        var newBal = user.balance - discountFromBalance;

        const { data, error } = await supabase
            .from('users')
            .update({ balance: newBal })
            .eq('user_id', user.user_id)
            .select();


        if (insertResponse.error) {
            console.error("Error inserting transaction:", insertResponse.error);
            return; // Handle error appropriately
        }

        fetchUser();
        setUseBalance(false);
        setSelectedOffer(null);
        setBill(null);

    };



    const isConfirmDisabled = () => {

    }

    const renderTransactions = (transactions) => {
        return transactions.map(({ id, type, created_at, amount, is_confirmed }, i) => (
            <li key={id} style={{ listStyleType: 'none' }}>
                <div className='list-item'>
                    <div className='wallet-balance'>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ backgroundColor: '#fff', borderRadius: '100px', border: '2px solid #000' }}>
                                <p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}>
                                    {type == 'earn' ? '₹' : type == 'refer' || type == 'invite' ? '🥤' : '₹'}</p>
                            </div>
                            <div>
                                <p style={{ fontWeight: 'bold', marginBottom: '4px' }}> {type == 'spend' ? `Saved ₹${amount} on bill` : type == 'earn' ? `Earned ₹${amount} cashback` : (type == 'invite' || type == 'refer') ? `You got a FREE drink` : ''}</p>
                                <p style={{ color: 'gray' }}>{formatDate(created_at)}</p>
                            </div>
                        </div>
                        {!is_confirmed && <p style={{ color: 'gray', fontStyle: 'italic', color: 'brown' }}>Processing</p>}
                    </div>
                </div>
            </li>
        ));
    };



    return (
        <div className="styled-container">
            {/* <div className='navbar'><div dangerouslySetInnerHTML={{ __html: nomsterSVG }} /></div> */}
            {isScannerVisible ? (
                <div className="scanner-modal">
                    <button className='secondary-button close-button' onClick={toggleScanner}>Cancel</button>
                    <Scanner width="100%" height="100%" onUpdate={(e, data) => data && (setCode(data.getText()), toggleScanner(), setBill(data.getText()))} />
                </div>
            ) : (
                <>
                    <BalanceCard />
                    {offerCards.map(renderCard)}
                    {bill ? <BillBox /> : <div className="offer-card" onClick={handleShareOffer}><img style={{ width: '100%' }} src={'https://xxsawwpbahvabbaljjuu.supabase.co/storage/v1/object/public/images/invite_friends.png'} /></div>}
                    {/* {transactions.length ? <h4>HISTORY</h4> : ''} */}
                    {!bill && <ul className='list'>{renderTransactions(transactions)}</ul>}
                    <button className='secondary-button' onClick={handleSignOut}>Sign out</button>
                </>
            )}
        </div>
    );




}

export default Home;

