<?php
/**
 * Plugin Name: FLiP
 * Plugin URI: https://www.flip.pt/Produtos/Plugin-do-FLiP-para-WordPress
 * Description: Portuguese spell checker, grammar checker and style checker, with or without the Spelling Reform of 1990.
 * Version: 1.5.6
 * Author: Priberam
 * Author URI: http://www.priberam.pt
 * License: GPL2
 * Text Domain: flip
 * Domain Path: /languages
 */
 
defined('ABSPATH') or die;

if ( !defined('DB_NAME') ) {
	header('HTTP/1.0 403 Forbidden');
	die;
}

if ( !defined('FLIP_URL') )
	define( 'FLIP_URL', plugin_dir_url( __FILE__ ) );
if ( !defined('FLIP_PATH') )
	define( 'FLIP_PATH', plugin_dir_path( __FILE__ ) );

/** Plugin class */
class Flip_Plugin {
	private $default_settings = null;
	private function __construct() {
		// Not set by the user
		$this->flip_internal_settings = array(
			'ScaytEnable' => true,
			'AutoStart' => true,
			'NumMaxSugest' => 4,
			'flip_internal_settings' => 0xFFFF,
			'ButtonVisible' => false
		);

		// Can be set by the user
		$this->default_settings = array(
			'Language' => 'pt-pt', //'pt-BR'
			'Acordo' => true,
			'GrammarSet' => 'common',
			'Key' => '',
			'CanAddWords' => true,
			'Webservice' => 'https://api.priberam.com/proofing-1.5/'
		);
		
		
		if( is_admin() ) {
			// Settings
			add_action('admin_menu', array(&$this, 'add_menu'));
			add_action('admin_init', array(&$this, 'register_settings'));

			//filter add external plugin
			add_filter('mce_external_plugins', array(&$this,'flip_add_tinymce_plugin'), 10, 1);
			//filter to add flip_mce_button 
			add_filter('mce_buttons', array(&$this, 'flip_register_mce_button'), 10, 1);
		}
		
		add_action('tiny_mce_before_init', array(&$this, 'flip_add_js_scripts'));
		add_action('after_wp_tiny_mce', array(&$this, 'flip_after_init_js_scripts'));
		add_action( 'init', array(&$this, 'my_plugin_load_plugin_textdomain'));
		add_filter( 'wp_insert_post_data' , array(&$this, 'filter_post_data'), 10, 1);

		add_filter( 'plugin_action_links_' . plugin_basename(__FILE__),  array(&$this, 'add_action_links') );

		$uri = $_SERVER['REQUEST_URI'];
		if (strpos($uri, 'page=flip_settings') !== false)
			add_action('wp_print_scripts', array(&$this, 'flip_options_key_check'));
	}

	protected static $instance = null;

	public static function get_instance() {

		// If the single instance hasn't been set, set it now.
		if ( null == self::$instance ) {
			self::$instance = new self;
		}

		return self::$instance;
	}

	public function add_action_links ( $links ) {
		$mylinks = array('<a href="' . admin_url( 'options-general.php?page=flip_settings' ) . '">' . __("Settings") . '</a>',);
		return array_merge($mylinks, $links );
	}

	public function my_plugin_load_plugin_textdomain() {
		load_plugin_textdomain('flip', false, basename( dirname( __FILE__ ) ) . '/languages/' );
	}

	public function filter_post_data($data) {
		$data['post_content'] = preg_replace('/<span class=(.+?)(pba_ort_error|pba_gram_error)(.+?)>(.+?)<\/span>/', '$4', $data['post_content']);
		return $data;
	}

	// Declare script for new button
	public function flip_add_tinymce_plugin( $plugin_array ) {
 		$data = get_plugin_data(__FILE__);
		$plugin_array['murmurhash'] = plugins_url() .'/flip/murmurhash3_gc.js?v=' . $data['Version'];
		$plugin_array['flip_engine'] = plugins_url() .'/flip/engine.js?v=' . $data['Version'];
		$plugin_array['flip'] = plugins_url() .'/flip/flip_tinymce.js?v=' . $data['Version'];
		return $plugin_array;
	}

	public function flip_register_mce_button( $buttons ) {
		$options = get_option('flip_settings', $this->default_settings);
		if ($options['ButtonVisible'])
			array_push( $buttons, 'flip' );
		return $buttons;
	
	}

	/* Settings */
	function add_menu() {
		add_options_page( 'FLiP', 'FLiP', 'manage_options', 'flip_settings', array(&$this, 'load_settings_page'));
	}
	
	function load_settings_page() {
		require_once(plugin_dir_path( __FILE__ ) . 'settings_page.php');
	}
	
	function register_settings() {
		register_setting( 'flip_settings', 'flip_settings');
		add_settings_section('flip_settings_general', __('Settings', 'flip'), '', 'flip_settings');

		add_settings_field('Key', __('API access key', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_general', array(
			'type' => 'flip_settings_string', 
			'label_for' => 'Key',
			'details' => '<span id="key_details"></span>',
			'comment' => '<span id="key_comment"></span>'
		));

		$languages = array('pt-pt' => __('Portuguese (Portugal)', 'flip'), 'pt-br' => __('Portuguese (Brazil)', 'flip'), 'es' => __('Spanish', 'flip'));
		add_settings_field('Language', __('Language', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_general', array('type' => 'flip_settings_combobox', 'label_for' => 'Language', 'values' => $languages));

		add_settings_field('Acordo', __('Use the Spelling Reform', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_general', array(
			'type' => 'flip_settings_checkbox',
			'label_for' => 'Acordo',
			'comment' => __('Only for Portuguese', 'flip')
		));

		add_settings_field('CanAddWords', __('Add words to custom dictionary', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_general', array('type' => 'flip_settings_checkbox', 'label_for' => 'CanAddWords', 'comment' => __('Only available in the full version', 'flip')));

		$grammarset = array('common' => __('Current', 'flip'), 'formal' => __('Formal', 'flip'), 'informal' => __('Informal', 'flip')/*, 'personalized' => __('Personalizado', 'flip')*/);
		add_settings_field('GrammarSet', __('Writing style', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_general', array('type' => 'flip_settings_combobox', 'label_for' => 'GrammarSet', 'values' => $grammarset));


		add_settings_section('flip_settings_adv', __('Advanced options', 'flip'), '', 'flip_settings');

		add_settings_field('Webservice', __('API address', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_adv', array(
			'type' => 'flip_settings_string',
			'label_for' => 'Webservice',
			'comment' => __('Attention: Updating this field can make the plugin unavailable', 'flip')
		));

		//add_settings_field('ScaytEnable', 'Ativar correção ao escrever', array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_client', array('type' => 'flip_settings_checkbox', 'label_for' => 'ScaytEnable'));
		//add_settings_field('AutoStart', __('Ativar no arranque', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_client', array('type' => 'flip_settings_checkbox', 'label_for' => 'AutoStart'));
		//add_settings_field('ButtonVisible', __('Botão visível na barra', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_client', array('type' => 'flip_settings_checkbox', 'label_for' => 'ButtonVisible'));


		//$numsugest = array(1, 2, 3, 4, 5, 6, 7, 8);
		//add_settings_field('NumMaxSugest', __('Número de sugestões', 'flip'), array(&$this, 'flip_settings_render'), 'flip_settings', 'flip_settings_client', array('type' => 'flip_settings_combobox', 'label_for' => 'NumMaxSugest', 'values' => $numsugest));

		wp_enqueue_style( 'flip_stylesheet', plugins_url( 'flip.css', __FILE__ ) );
	}

	function flip_key_setting_render() {

	}

	function flip_settings_render($args) {
		$this->{$args['type']}($args);
		
		if (isset($args['details'])) {
			$this->flip_settings_details($args);
		}

		if (isset($args['comment'])) {
			$this->flip_settings_comment($args);
		}
	}

	function flip_settings_comment($args) {
		echo '<div class="setting_comment">';
		echo $args['comment'];
		echo '</div>';
	}

		function flip_settings_details($args) {
		echo '<span class="setting_details">';
		echo $args['details'];
		echo '</span>';
	}

	function flip_settings_string($args) {
		$options = get_option('flip_settings', $this->default_settings);
		echo "<input id='{$args['label_for']}' name='flip_settings[{$args['label_for']}]' size='40' type='text' value='{$options[$args['label_for']]}' />";
	}

	function flip_settings_checkbox($args) {
		$options = get_option('flip_settings', $this->default_settings);
		echo "<input id='{$args['label_for']}' name='flip_settings[{$args['label_for']}]' type='checkbox' ";
		if ($options[$args['label_for']])
			echo 'checked = "checked"';
		echo '/>';
	}

	function flip_settings_combobox($args) {
		$options = get_option('flip_settings', $this->default_settings);
		echo "<select id='{$args['label_for']}' name='flip_settings[{$args['label_for']}]' >";
		
		$assoc = ($args['values'] !== array_values($args['values']));
		
		foreach($args['values'] as $key => $value) {
			$val = $assoc ? $key : $value;
			echo '<option value="' . $val .'" ';
			if ($options[$args['label_for']] == $val)
				echo "selected='selected'";
			echo ">$value</option>";
		}
		echo '</select>';
	}
	
	function flip_add_js_scripts($settings) {
		$options = get_option('flip_settings', $this->default_settings);
		$mergeoptions = [];
		foreach ($this->default_settings as $key => $value) {
			if (is_string($value))
				$mergeoptions[$key] = (isset($options[$key]) ? $options[$key] : $value);
			else if (is_bool($value))
				$mergeoptions[$key] = isset($options[$key]) ? true : false;
			else
				$mergeoptions[$key] = (isset($options[$key]) ? $options[$key] : $value);
		}
		$all = array_merge($mergeoptions, $this->flip_internal_settings);

		$script =  '<script type="text/javascript">';
		$script .= 'var flipoptions = ' . json_encode($all) . '; ';
		

    	$strings =  array(
			'maissugestoes' => __('More suggestions', 'flip'),
			'flip_adiciona' => __('Add word', 'flip'),
			'flip_ignora' => __('Ignore', 'flip'),
			'flip_ignora_todos' => __('Ignore All', 'flip'),
			'err_timeout' => __('The connection to the server expired.', 'flip')
		);

		$script .= 'var flipstrings = ' . json_encode($strings) . ';';
		$script .= '</script>';
		echo $script;
		
		return $settings;
	}

	function flip_after_init_js_scripts() {
	 ?>
	 <script>
	 	(function() {
			 try {
				 setTimeout(function fn() {
					 if (tinymce.activeEditor)
					 	tinymce.activeEditor.flipinstance.on("Error", function(err) {
							 if (err.status == 401)
							 	tinymce.activeEditor.flipinstance.Settings("Key", "trialonlyspellernosuggestions");
						});
					 else
					 	setTimeout(fn, 100);
				 }, 100);
				 
			 }
			 catch(err){}
		 })();
	 </script>
	 <?php
	}
	
	function flip_options_key_check() {
			$options = get_option('flip_settings', $this->default_settings);
			$key = $options['Key'];

			$url = $options['Webservice'] . '/userdict/pt-pt/true?n=0';

			$default_msg = sprintf(__('Click <a href="%s" target="_blank">here</a> to buy an API key and use the full FLiP proofing tools', 'flip' ), esc_url('https://www.flip.pt/Produtos/Plugin-do-FLiP-para-WordPress/Comprar'));
			$default_comment = __('Leaving this field empty you will be using a limited version of FLiP', 'flip');

			$expired_comment = __('Key is invalid or has expired. To use a limited version of FliP leave the key empty.', 'flip' );

			$unavailable_comment = __('Server unavailable.', 'flip' );

		?> 
		<script>
			(function() {
				function setText(msg, comment) {
					var mel = document.getElementById("key_details");
					if (mel)
						mel.innerHTML = msg;
					var cel = document.getElementById("key_comment");
					if (cel)
						cel.innerHTML = comment;
				}

				function error(err) {
					setText('<?php echo $default_msg; ?>', '<?php echo $unavailable_comment; ?>')
				}

				function init(evt) {

					var key = '<?php echo $key; ?>';
					if (key.trim().length) {
						var oReq = new XMLHttpRequest();
						oReq.open("GET", "<?php echo $url ?>");
						oReq.setRequestHeader('X-Priberam-auth-key', key);
						oReq.timeout = 1000;
						oReq.addEventListener("load", function(value) {
							if (value.target.status != 200) {
								setText('<?php echo $default_msg; ?>', '<?php echo $expired_comment; ?>')
							}
						});
						oReq.addEventListener("error", error);
						oReq.addEventListener("timeout", error);

						oReq.send();
					}
					else {
						setText('<?php echo $default_msg; ?>', '<?php echo $default_comment; ?>')
					}
				}

			if(window.attachEvent) {
				window.attachEvent('onload', init);
			} else {
				if(window.onload) {
					var currentonload = window.onload;
					var newonload = function(evt) {
						currentonload(evt);
						init(evt);
					};
					window.onload = newonload;
				} else {
					window.onload = init;
				}
			}

			})();

		</script>
		<?php
	}	
}

Flip_Plugin::get_instance();

?>
