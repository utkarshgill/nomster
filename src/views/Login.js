import React, { useEffect } from 'react';

import mixpanel from 'mixpanel-browser';
import { supabase } from '../App';
import svgData from './svgData';
import { useNavigate, useLocation } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const inviteCode = new URLSearchParams(location.search).get('i');


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
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://www.nomster.in/home'
      }
    });
  };

  // Listen for the login event
  useEffect(() => {
    const sessionListener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          const user = session?.user; mixpanel.identify(user?.id);


          // Check if the user is new by querying the users table
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', user?.id);

          // Retrieve the invite code from session storage
          const storedInviteCode = sessionStorage.getItem('invite_code');
          sessionStorage.removeItem('invite_code'); // Optionally, clear it after retrieval


          if (!data?.length) {
            storedInviteCode ? mixpanel.track('sign up', { type: 'invite' }) : mixpanel.track('sign up')
            // Create a record in Supabase users table
            await supabase.from('users').insert([
              { user_id: user?.id, full_name: user?.full_name, avatar_url: user?.avatar_url, email: user?.email, invited_by: storedInviteCode, is_activated: false },
            ]);
          }
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
      <div className='hero-card'>
        <div dangerouslySetInnerHTML={{ __html: svgData.offer }} />
      </div>
      <button className='scanner' onClick={handleGoogleSignIn}>Continue with Google</button>
    </div>
  );
}

export default Login;
