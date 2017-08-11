<?php

if (!current_user_can( 'manage_options' ) ) {
	wp_die('Unauthorized');
}

?>

<div class="wrap">
  <h2>
    <?php  _e('FLiP - Portuguese proofing tools, by Priberam', 'flip'); ?>
  </h2>
  <div>
    <p>
      <?php
  printf(__("Check the spelling, grammar and style of your texts with <a href=\"%s\" target=\"_blank\">FLiP</a>, the proofing tools used in the biggest Portuguese language publishers, both in Portugal and in Brazil. FLiP's WordPress plugin includes spell checkers, grammar checkers and style checkers for Brazilian and European Portuguese, with the option to use the Spelling Reform of 1990. Vertical lexicons for tens of knowledge domains are available to proofread texts of specific areas. It is possible to choose between 3 writing styles.", 'flip'), esc_url('https://www.flip.pt/Produtos/Plugin-do-FLiP-para-WordPress'));
?>
    </p>
    <p>
      <?php
_e("IMPORTANT: the free version of the plugin only checks the spelling and does not use the Spelling Reform of 1990. Additionally it doesn't suggest any corrections for the highlighted errors. That is, no grammar or style errors are checked, the Spelling Reform of 1990 is not available and, for the spelling mistakes which are highlighted, no corrections are suggested.", 'flip');
?>
    </p>
    <p>
      <?php
printf(__('To be able to fully use the plugin you must get an access key <a href="%s" target="_blank">here</a>.', 'flip'), esc_url('https://www.flip.pt/Produtos/Plugin-do-FLiP-para-WordPress/Comprar'));
  ?>
    </p>
  </div>

  <form method="post" action="options.php">
    <?php settings_fields( 'flip_settings' ); ?>
    <?php do_settings_sections( 'flip_settings' ); ?>
    <?php submit_button(); ?>

  </form>
</div>