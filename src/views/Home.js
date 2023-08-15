import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCodeCanvas from 'qrcode.react'; import mixpanel from 'mixpanel-browser';



import svgData from './svgData';
import './styles.scss'; // Import the CSS file



function Home() {
    const navigate = useNavigate();
    const offerSVG = svgData.offer;
    const nomsterSVG = svgData.nomster;
    const tcwLogo = svgData.tcwLogo;
    const [user, setUser] = useState(null);
    const [uid, setUid] = useState('');
    const [balance, setBalance] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [inviteCards, setInviteCards] = useState([]);

    const handleCarouselScroll = () => {
        mixpanel.track('scroll offer', { user_id: user.id });

        // Remove the scroll listener after the first scroll event
        const scrollContainer = document.querySelector('.horizontal-scroll-container');
        scrollContainer.removeEventListener('scroll', handleCarouselScroll);
    };



    useEffect(() => {
        const scrollContainer = document.querySelector('.horizontal-scroll-container');

        // Attach the scroll listener
        scrollContainer.addEventListener('scroll', handleCarouselScroll);

        // Detach the scroll listener when the component unmounts
        return () => {
            scrollContainer.removeEventListener('scroll', handleCarouselScroll);
        };
    }, [user]); // The dependency on the 'user' ensures that the effect runs when the user object changes



    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/');
            setUser(null);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    useEffect(() => {
        const fetchSession = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUser(user);
                setUid(user.id);
                fetchBalance(user.id);
                fetchInviteCards(user.id); // Fetch invitations here
            } else {
                console.error('Error fetching session: User object is not defined');
                navigate('/'); // Redirect to the root path if no user is logged in
            }
        };
        fetchSession();
    }, []);

    const fetchInviteCards = async (userId) => {
        if (!userId) {
            console.warn('User ID is not defined. Skipping fetching of invitations.');
            return;
        }

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('invited_by', userId)
            .order('created_at', { ascending: false });;

        if (data) {
            setInviteCards(data.map(invite => ({
                userId: invite.user_id, // Include the 'id' field here
                offer: svgData.offer,
                isActivated: invite.is_activated,
                createdAt: invite.created_at
            })));
        }
        if (error) {
            console.error('Error fetching invitations:', error);
        }
    };




    useEffect(() => {
        if (user) {
            const subscription = supabase
                .channel('notifications')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, handleTransactionUpdated)
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [user]);

    const handleTransactionUpdated = (event) => {
        console.log('Transaction updated:', event);
        if (event.new && (event.eventType === 'INSERT' || event.eventType === 'UPDATE')) {
            fetchTransactions(); // Re-fetch transactions to reflect changes
        }
    };








    async function fetchTransactions() {
        if (user) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
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
        if (user) {
            fetchTransactions();
        }
    }, [user]);


    const fetchBalance = async (userId) => {
        if (!userId) {
            console.error('Cannot fetch balance without user ID');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('users')
                .select('balance')
                .eq('user_id', userId)
                .single();
            if (data && data.balance !== null) {
                setBalance(data.balance);
            } else {
                console.error('Error fetching balance:', error || 'Balance data is not defined');
            }
        } catch (error) {
            console.error('Error fetching balance:', error);
        }
    };


    useEffect(() => {
        if (user) {
            const subscription = supabase
                .channel('any')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, handleRecordUpdated)
                .subscribe();
            return () => {
                subscription.unsubscribe();
            };
        }
    }, [user]);


    const handleRecordUpdated = (event) => {
        console.log('Record updated:', event);

        // Update the balance when the user's data changes
        if (event && event.new && event.new.balance) {
            setBalance(event.new.balance);
        }

        // Check if the change is related to invitations
        if (event.new && event.new.invited_by === user.id) {
            if (event.eventType === 'INSERT') {
                console.log('Invite inserted');
                setInviteCards(currentInviteCards => [
                    ...currentInviteCards,
                    {
                        userId: event.new.user_id, // Change to 'user_id'
                        offer: svgData.offer,
                        isActivated: event.new.is_activated
                    }
                ]);
            } else if (event.eventType === 'UPDATE') {
                console.log('Invite updated');
                setInviteCards(currentInviteCards => {
                    const updatedCards = [...currentInviteCards];
                    const cardIndex = updatedCards.findIndex(card => card.userId === event.new.user_id); // Change to 'user_id'
                    if (cardIndex !== -1) {
                        updatedCards[cardIndex].isActivated = event.new.is_activated;
                    }
                    return updatedCards;
                });
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
    const handleShareOffer = () => {
        const referralUrl = `https://nomster.in/?i=${user.id}`; // Replace with your actual referral URL
        const shareMessage = `🎁 ${user.user_metadata.full_name} sent you a gift. 👉 ${referralUrl}`;

        mixpanel.track('tap share offer', { user_id: user.id });

        if (navigator.share) {
            navigator.share({
                title: 'Invite Friends',
                text: shareMessage,
                url: referralUrl,
            })
                .then(() => {
                    alert('Shared successfully!');
                    mixpanel.track('share offer successful', { user_id: user.id });
                })
                .catch((error) => console.error('Error sharing:', error));
        } else {
            // Fallback for browsers that do not support Web Share API
            console.log('Web Share API not supported');
            // You can provide an alternative sharing method here, such as copying the message to clipboard
        }
    };

    return (
        <div className="styled-container">

            <div className='navbar'><div dangerouslySetInnerHTML={{ __html: nomsterSVG }} />
            </div>

            {/* <p className='greeting'>
                {user ? `Hi ${user.user_metadata.full_name}! 👋` : ''}
            </p><p className='greeting' style={{ color: '#87B300' }}>
                {`You have ${balance !== null ? `₹${balance.toFixed(2)}` : ''}`}

            </p> */}

            <div className="horizontal-scroll-container">
                <div className="hero-card">
                    <h1>{balance !== null ? `₹${balance.toFixed(2)}` : 'Loading balance...'}</h1>
                    <QRCodeCanvas className="qr-code" size={720} value={uid} includeMargin />
                    <div dangerouslySetInnerHTML={{ __html: tcwLogo }} />
                </div>

                {inviteCards.map((card, index) => (
                    <div key={index} className="hero-card" style={{ filter: card.isActivated ? 'none' : 'grayscale(100%)' }}>
                        <div dangerouslySetInnerHTML={{ __html: card.offer }} />
                    </div>
                ))}


                <div className="hero-card" onClick={handleShareOffer}>
                    <div dangerouslySetInnerHTML={{ __html: offerSVG }} />
                </div>
            </div>


            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        <div className='list-item'  >
                            <div className='wallet-balance'>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <p style={{ fontWeight: 'bold', fontSize: '24px', backgroundColor: '#eee', height: '32px', width: '32px', textAlign: 'center', borderRadius: '100px', padding: '2px' }}> {transaction.amount > 0 ? '₹' : '✓'}</p>
                                    <div><p>{transaction.amount < 0 ? 'Redeemed' : 'Earned'}</p> <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                    </div>
                                </div>
                                <p>{renderTransactionAmount(transaction)}</p></div>


                        </div>
                    </li>
                ))}
            </ul>
            <button className='secondary-button' onClick={handleSignOut}>Sign out</button>
        </div >
    );
}

export default Home;
