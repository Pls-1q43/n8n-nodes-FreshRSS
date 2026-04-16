import type {
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class FreshrssApi implements ICredentialType {
	name = 'freshrssApi';

	displayName = 'FreshRSS API';

	icon: Icon = { light: 'file:freshrss.svg', dark: 'file:freshrss.dark.svg' };

	documentationUrl = 'https://freshrss.github.io/FreshRSS/en/developers/06_GoogleReader_API.html';

	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'https://freshrss.example.com',
			description: 'The URL of your FreshRSS instance (without trailing slash)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			required: true,
			default: '',
			description: 'Your FreshRSS username (email)',
		},
		{
			displayName: 'API Password',
			name: 'apiPassword',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Your FreshRSS API password (set in FreshRSS under Settings > Profile > API password)',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{$credentials.serverUrl.replace(/\\/$/, "")}}/api/greader.php/accounts/ClientLogin?Email={{$credentials.username}}&Passwd={{$credentials.apiPassword}}',
		},
	};
}
