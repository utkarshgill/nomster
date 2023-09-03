import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCodeCanvas from 'qrcode.react';
import mixpanel from 'mixpanel-browser';
import svgData from './svgData';
import './styles.scss';
import { useStatus } from '../models/GlobalState';


function Home() {

    const [deferredPrompt, setDeferredPrompt] = useState(null);



    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Trigger the prompt

        });
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const [number, setNumber] = useState(0);
    const [code, setCode] = useState('&%');
    const [customer, setCustomer] = useState(null);
    const [offer, setOffer] = useState(null);
    const [isScannerVisible, setScannerVisible] = useState(false);

    //bill box related state


    const [billAmount, setBillAmount] = useState(0);
    const [discount, setDiscount] = useState(0);


    const navigate = useNavigate();
    const { offer: offerSVG, nomster: nomsterSVG, tcwLogo } = svgData;
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [offerCards, setOfferCards] = useState([]);

    const { status } = useStatus();

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
        const options = {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return new Date(dateString).toLocaleString(undefined, options);
    };



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

    const [selectedCard, setSelectedCard] = useState(null);



    const handleApply = (indexOrType) => {
        if (selectedCard === indexOrType) {
            setSelectedCard(null);
            setDiscount(0);
            setOffer(null);

        } else {
            setSelectedCard(indexOrType);
            if (indexOrType == 'balance') {
                setDiscount(user.balance);
                setOffer(null);

            }
            else {
                setOffer(offerCards[indexOrType]);
                setDiscount(0);

            }
            // calculateFinalBill(indexOrType);
        }


        // setDiscount(user.balance)
    };

    const renderCard = (card, index) => {
        if (card.is_used) return null;

        const imgUrl = card.type === 'invite' ? card.inviter?.avatar_url : card.ref?.avatar_url;
        const name = card.type === 'invite' ? card.inviter?.full_name : card.ref?.full_name;
        const firstName = name.split(' ')[0];
        const isCardSelected = selectedCard === index;

        return (

            (card.type === 'invite' || card.type === 'refer') &&

            <div key={index} className="offer-card">


                {/* <img style={{ borderRadius: '100px', width: '24px' }} src={imgUrl} alt="" /> */}
                <div>
                    <p className='label' >{card.type === 'invite' ? `${firstName} invited you` : card.type === 'refer' && !card.is_unlocked ? `You invited ${firstName} (Unlocks after their first order)` : card.type === 'refer' && card.is_unlocked ? `You invited ${firstName}` : ''}</p>
                    <h1 style={{ textAlign: 'left' }}>{card.name}</h1>
                </div>
                <button
                    className={`secondary-button ${isCardSelected ? 'applied-state' : ''}`}
                    onClick={() => handleApply(index)}
                >
                    {isCardSelected ? "Selected" : "Select"}
                </button>

            </div>


        );
    };

    const BalanceCard = () => {
        const isBalanceCardSelected = selectedCard === 'balance';

        return (
            <div className="balance-card">
                <div >
                    <p className='label' style={{ textAlign: 'left' }}>Cash balance</p>
                    <h1 style={{ textAlign: 'left' }}>{user?.balance != undefined ? `₹${user?.balance?.toFixed(2)}` : `₹${(0).toFixed(2)}`}</h1>

                </div>
                <button
                    className={`secondary-button ${isBalanceCardSelected ? 'applied-state' : ''}`}
                    onClick={() => handleApply('balance')}
                >
                    {isBalanceCardSelected ? "Selected" : "Select"}
                </button>
            </div>
        );
    };











    const renderTransactions = (transactions) => {
        return transactions.map(({ id, type, created_at, amount, is_confirmed, bill_value }, i) => (
            is_confirmed ?
                <li key={id} style={{ listStyleType: 'none' }}>
                    <div className='list-item'>
                        <div className='wallet-balance' style={{ padding: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ backgroundColor: '#fff', borderRadius: '100px', border: '2px solid #000' }}>
                                    <p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}>
                                        {type === 'spend' ? '₹' : (type === 'refer' || type === 'invite') ? '🥤' : '₹'}</p>
                                </div>
                                <div>
                                    <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                        {
                                            (() => {
                                                let message = '';

                                                if (type === 'spend') {
                                                    message += `₹${Math.abs(amount.toFixed(2))} discount`;
                                                } else if (type === 'invite' || type === 'refer') {
                                                    message += `Free drink (worth ₹${amount})`;
                                                }

                                                const cashback = ((bill_value - (type === 'spend' ? amount : 0)) * 0.1).toFixed(2);
                                                if (cashback > 0) {
                                                    message += (message ? ' + ' : '') + `₹${cashback} cashback`;
                                                }

                                                return message;
                                            })()
                                        }
                                    </p>
                                    <p style={{ color: 'gray' }}>{formatDate(created_at)}</p>
                                </div>
                            </div>
                            {!is_confirmed && <p style={{ color: 'brown', fontStyle: 'italic' }}>Processing</p>}
                        </div>
                    </div>
                </li> : null
        ));
    };






    const handleClick = (url) => {
        window.open(url, '_blank');
    }

    const handleConfirm = async () => {
        if (!user) {
            console.error('User is null');
            return;
        }
        if (number <= 0) {
            console.error('Bill value is zero or negative. Operation not allowed.');
            return;
        }


        const transaction = {
            user_id: user.user_id,
            bill_value: number,
            is_confirmed: false,
            type: 'none',

        }


        if (selectedCard == 'balance') {
            transaction.amount = Math.min(number, user.balance);
            transaction.type = 'spend';
        }


        else if (offerCards[selectedCard]?.type == 'refer') {

            transaction.amount = offer.value;
            transaction.offer_id = offer.id;
            transaction.type = 'refer';

            const updatedCards = [...offerCards];

            // Update the is_used property of the selectedCard
            updatedCards[selectedCard].is_used = true;

            // Update the state or wherever you're storing the offerCards
            setOfferCards(updatedCards);

        }
        else if (offerCards[selectedCard]?.type == 'invite') {

            transaction.amount = offer.value;
            transaction.offer_id = offer.id;
            transaction.type = 'invite';
            transaction.ref_offer_id = offer.ref_offer_id;


        }


        await supabase.from('transactions').insert(transaction);





        clearState();
        fetchTransactions(user.user_id);
    };



    function clearState() {
        setNumber(0)
        setCode('&%')
        setCustomer(null)
        setOffer(null)
        setSelectedCard(null)
        setDiscount(0)
    }

    function handleCancel() {
        clearState()
    }

    const handleInputChange = e => {

        setNumber(e.target.value);
    };

    const [isFocused, setIsFocused] = useState(false);


    return (
        <div className="styled-container">
            {deferredPrompt && <div className='navbar'>
                <p >Install the app for a smoother experience.</p>
                <button className='secondary-button' onClick={handleInstallClick}>Install App</button>

                {/* <div dangerouslySetInnerHTML={{ __html: svgData.nomster }} /> */}
            </div>}


            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>



                {transactions.some(transaction => !transaction.is_confirmed) ?

                    <div className='claim-box' >

                        <p style={{ fontSize: '24px', width: '100%', textAlign: 'center', lineHeight: '1.2' }} >{'Waiting for confirmation...'}
                        </p>

                        <p  >{'Please wait :)'}
                        </p>










                    </div>

                    :



                    <div className='claim-box' >
                        <div>
                            <h1 style={{ fontSize: '32px', width: '100%', textAlign: 'center', lineHeight: '1.2', marginBottom: '12px', fontWeight: 'bold' }} >{'Select your offer'}
                            </h1>
                            <p style={{ fontSize: '16px', width: '100%', textAlign: 'center', lineHeight: '1.2' }} >{'Get +10% cashback on every bite!'}
                            </p>
                        </div>

                        {user?.balance ? <BalanceCard /> : <div />}
                        {offerCards.map(renderCard)}
                        <div className="offer-card" onClick={handleShareOffer}>
                            {/* <img style={{ width: '100%' }} src={'https://xxsawwpbahvabbaljjuu.supabase.co/storage/v1/object/public/images/invite_friends.png'} /> */}


                            Invite friends and get a free drink.
                        </div>


                        {/* <h4 style={{ textAlign: 'left', width: '100%', margin: 0 }}>YOUR REWARDS</h4> */}



                        <div className="input-wrapper">
                            <label htmlFor="billAmount" className={isFocused ? "active" : ""}>Enter bill amount</label>
                            <input
                                id="billAmount"
                                className='bill-input'
                                placeholder={isFocused ? '₹0.00' : ''}
                                type="number"
                                value={number ? number : ''}
                                onChange={handleInputChange}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => { if (!number) setIsFocused(false); }}
                            />
                        </div>


                        {/* <div className='wallet-balance'>
                            <h3>Total bill</h3>
                            <h3>{`₹${number ? parseFloat(number).toFixed(2) : 0}`}</h3>
                        </div> */}
                        {!discount ? '' : <div className='wallet-balance'><p>{`Discount`}</p><h3>-₹{Math.min(number, user.balance).toFixed(2)}</h3></div>}
                        {!offer ? '' : <div className='wallet-balance'><p>Offer</p><h3>{`${offer.name} (worth ₹${offer.value})`}</h3></div>}
                        {number ? <div className='wallet-balance'>
                            <p>To Pay</p>
                            <h3>₹{Math.max(number - (selectedCard == 'balance' ? user.balance : 0), 0).toFixed(2)}</h3>
                        </div> : ''}
                        <div className='stack-h-fill' style={{ justifyContent: 'space-between', width: '100%', gap: '10px' }}>
                            {/* <button className='secondary-button' onClick={handleCancel}>Cancel</button> */}

                            <button className='scanner' disabled={!number} onClick={handleConfirm}>
                                {parseFloat((0.1 * (Math.max(number - (selectedCard == 'balance' ? user.balance : 0), 0))).toFixed(2))
                                    ? <>
                                        Claim ₹{(0.1 * (Math.max(number - (selectedCard == 'balance' ? user.balance : 0), 0))).toFixed(2)} cashback
                                    </>
                                    : 'Claim rewards'}
                            </button>
                        </div>


                    </div>






                }   </div>
            <div>

                <h3>History</h3>

                <ul className='list'>{renderTransactions(transactions)}</ul>

            </div>
            <div className='hero-card' >
                <div className='wallet-balance' style={{ alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: 0 }}>

                    <h2 >{'The Country Wok, Vadodara'}
                    </h2>
                    <div dangerouslySetInnerHTML={{ __html: tcwLogo }} />

                </div>

                <div className='stack-h-fill' style={{ flexWrap: 'wrap', gap: '12px' }}>
                    <a onClick={() => handleClick('https://goo.gl/maps/ssxsgRkP3Q8EES979')}>Directions</a>
                    <a onClick={() => handleClick('https://link.zomato.com/xqzv/rshare?id=318626019a7b92f9')}>Zomato</a>
                    <a onClick={() => handleClick('https://www.swiggy.com/menu/460656')}>Swiggy</a>
                    <a href={`tel:${'+918199079413'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Call us at 8199079413</a>

                </div>


            </div>

            <button className='secondary-button' onClick={handleSignOut}>Sign out</button>

            <footer className='footer'>

                <a href="/tos">Terms of Service</a>
                <a href="https://twitter.com/nomsterindia" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="/privacy">Privacy Policy</a>


            </footer>
        </div>
    );




}

export default Home;

