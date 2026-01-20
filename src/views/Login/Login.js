import {useState, useCallback} from 'react';
import {Panel, Header} from '@enact/sandstone/Panels';
import Button from '@enact/sandstone/Button';
import Input from '@enact/sandstone/Input';
import Spinner from '@enact/sandstone/Spinner';
import {useAuth} from '../../context/AuthContext';

import css from './Login.module.less';

const Login = ({onLoggedIn}) => {
	const {login, isLoading, isAuthenticated} = useAuth();

	const [serverUrl, setServerUrl] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState(null);
	const [isConnecting, setIsConnecting] = useState(false);

	const handleServerChange = useCallback((e) => setServerUrl(e.value), []);
	const handleUsernameChange = useCallback((e) => setUsername(e.value), []);
	const handlePasswordChange = useCallback((e) => setPassword(e.value), []);

	const handleLogin = useCallback(async () => {
		if (!serverUrl || !username) return;

		setIsConnecting(true);
		setError(null);

		try {
			await login(serverUrl, username, password);
			onLoggedIn?.();
		} catch (err) {
			setError(err.message || 'Login failed');
		} finally {
			setIsConnecting(false);
		}
	}, [serverUrl, username, password, login, onLoggedIn]);

	if (isLoading) {
		return (
			<Panel>
				<div className={css.loading}>
					<Spinner />
				</div>
			</Panel>
		);
	}

	if (isAuthenticated) {
		onLoggedIn?.();
		return null;
	}

	return (
		<Panel>
			<Header title="Moonfin" subtitle="Connect to Jellyfin" />
			<div className={css.container}>
				<div className={css.form}>
					<Input
						placeholder="Server URL (e.g., http://192.168.1.100:8096)"
						value={serverUrl}
						onChange={handleServerChange}
						disabled={isConnecting}
					/>
					<Input
						placeholder="Username"
						value={username}
						onChange={handleUsernameChange}
						disabled={isConnecting}
					/>
					<Input
						placeholder="Password"
						type="password"
						value={password}
						onChange={handlePasswordChange}
						disabled={isConnecting}
					/>
					{error && <div className={css.error}>{error}</div>}
					<Button
						onClick={handleLogin}
						disabled={isConnecting || !serverUrl || !username}
						size="large"
					>
						{isConnecting ? 'Connecting...' : 'Sign In'}
					</Button>
				</div>
			</div>
		</Panel>
	);
};

export default Login;
