import React, { useEffect, useState } from 'react';

import mixpanel from 'mixpanel-browser';
import { supabase } from '../App';
import svgData from './svgData';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStatus } from '../models/GlobalState';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const inviteCode = new URLSearchParams(location.search).get('i');
  const offerType = new URLSearchParams(location.search).get('o'); // Extracting offer type from URL
  const [offerImage, setOfferImage] = useState(null); // State to store offer image
  const { setStatus } = useStatus();

  useEffect(() => {
    (async () => {
      if (offerType) {
        const { data } = await supabase
          .from('offer_types')
          .select('image')
          .eq('type', offerType).single();

        if (data) {
          setOfferImage(data.image);
        }
      }
    })();
  }, [offerType]);

  // Check if the user is already authenticated
  useEffect(() => {
    (async () => {

      const { data: { user } } = await supabase.auth.getUser()
      if (user) navigate('/home');
    })();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    mixpanel.track("tap sign in", { "method": "google" });
    if (inviteCode) {
      sessionStorage.setItem('invite_code', inviteCode);
      if (offerType) {
        sessionStorage.setItem('offer_type', offerType);
      }

    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: '/home',
        scopes: 'email profile openid'
      }
    });
  };

  const handleUserSignIn = async (user, storedInviteCode, storedOfferType) => {
    // Check if the user is new by querying the users table
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user?.id);



    if (!data?.length) {
      storedInviteCode ? mixpanel.track('sign up', { type: 'invite' }) : mixpanel.track('sign up')
      // Create a record in Supabase users table
      await supabase.from('users').insert([
        {
          user_id: user?.id,
          full_name: user?.user_metadata?.full_name,
          avatar_url: user?.user_metadata?.avatar_url,
          email: user?.email, invited_by: storedInviteCode,
          is_activated: false
        },
      ]);
      await supabase.from('offers').insert([{

        user_id: user?.id,
        type: 'loyal',
        value: 10,

      }]);

      // If invite code exists, create an offer with type INVITE and referral_uid = inviteCode
      if (storedInviteCode) {
        console.log(storedOfferType);
        if (storedOfferType) {
          const { data: offerData } = await supabase
            .from('offer_types')
            .select('*')
            .eq('type', storedOfferType).single();

          console.log(offerData);// After the insertion is done
          setStatus('inserting');

          if (offerData.type == 'invite') {
            const { data, error } = await supabase.from('offers').insert([
              {
                user_id: storedInviteCode,
                type: 'refer',
                is_unlocked: false
              }
            ]).select().single();
            await supabase.from('offers').insert([
              {
                user_id: user?.id,
                type: offerData.type,
                referral_uid: data.id,
              }
            ]);
          }
          else if (offerData.type == 'scan') {

            await supabase.from('offers').insert([
              {
                user_id: user?.id,
                type: offerData.type,
                referral_uid: storedInviteCode,
              }
            ]);
          }


          else {

            // console.log(1);
            // await supabase.from('offers').insert([
            //   {
            //     user_id: user?.id,
            //     type: 'invite',
            //     referral_uid: storedInviteCode
            //   }
            // ]);
          }
        }
        // else {
        //   console.log(2);
        //   const { data, error } = await supabase.from('offers').insert([
        //     {
        //       user_id: storedInviteCode,
        //       type: 'refer',
        //       is_unlocked: false
        //     }
        //   ]).select().single();

        //   console.log("Inserted refer data:", data); // Log the data to see its structure


        //   await supabase.from('offers').insert([
        //     {
        //       user_id: user?.id,
        //       type: 'invite',
        //       referral_uid: data.id
        //     }
        //   ]);
        // }
        setStatus('completed');

      }
    }
  };

  // Listen for the login event
  useEffect(() => {
    const sessionListener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          const user = session?.user;
          mixpanel.identify(user?.id);
          // Retrieve the invite code from session storage
          const storedInviteCode = sessionStorage.getItem('invite_code');
          const storedOfferType = sessionStorage.getItem('offer_type');
          sessionStorage.removeItem('invite_code'); // Optionally, clear it after retrieval
          sessionStorage.removeItem('offer_type'); // Optionally, clear it after retrieval


          await handleUserSignIn(user, storedInviteCode, storedOfferType);
          mixpanel.track('sign in');
          // Navigate to home
          navigate('/home');
        }
      }
    );

    return () => {
      sessionListener.data.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className='styled-container'>
      <div className='navbar'>
        <div dangerouslySetInnerHTML={{ __html: svgData.nomster }} />
      </div>
      {offerImage ? <div className='hero-card' style={{ backgroundImage: `url(${offerImage})` }}>

      </div> : <div />}
      <button className='scanner' onClick={handleGoogleSignIn}>Continue with Google</button>
    </div>
  );
}

export default Login;
