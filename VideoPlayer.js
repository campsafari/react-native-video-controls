import React, { Component } from 'react';
import Video from 'react-native-video';
import {
    TouchableWithoutFeedback,
    TouchableHighlight,
    PanResponder,
    StyleSheet,
    Touchable,
    Animated,
    Easing,
    Image,
    View,
    Text,
    Slider,
    Platform,
} from 'react-native';
import _ from 'lodash';

export default class VideoPlayer extends Component {


    static defaultProps = {
        minTrackColor: 'white',
        maxTrackColor: '#888',
        playWhenInactive: false,
        playInBackground: false,
        repeat: false,
        title: '',
        thumbImage: require('./assets/img/thumb.png'),
        playIcon: <Image source={ require( './assets/img/play.png' ) } />,
        pauseIcon: <Image source={ require( './assets/img/pause.png' ) } />,
        volumeIcon: <Image source={ require( './assets/img/volume.png' ) } />,
        volumeMutedIcon: <Image source={ require( './assets/img/volume.png' ) } />,
        shrinkIcon: <Image source={ require( './assets/img/shrink.png' ) } />,
        expandIcon: <Image source={ require( './assets/img/expand.png' ) } />,
        backIcon: <Image source={ require( './assets/img/back.png' ) } />,
    };

    constructor( props ) {
        super( props );

        /**
         * All of our values that are updated by the
         * methods and listeners in this class
         */
        const isFullscreen = this.props.resizeMode === 'cover' || false;
        this.state = {
            // Video
            resizeMode: this.props.resizeMode || 'contain',
            paused: this.props.paused || false,
            muted: this.props.muted || false,
            volume: this.props.volume || 1,
            rate: this.props.rate || 1,
            // Controls
            isFullscreen: isFullscreen,
            fullscreenToggle: (this.props.fullscreenToggle === false) ? false : true,
            showTimeRemaining: true,
            lastScreenPress: 0,
            showControls: true,
            seeking: false,
            loading: false,
            currentTime: 0,
            error: false,
            duration: 0,
        };

        /**
         * Our app listeners and associated methods
         */
        this.events = {
            onError: this.props.onError || this._onError,
            onEnd: this.props.onEnd || this._onEnd,
            onScreenPress: this._onScreenPress,
            onLoadStart: this._onLoadStart,
            onProgress: this._onProgress,
            onLoad: this._onLoad,
        };

        /**
         * Functions used throughout the application
         */
        this.methods = {
            onBack: this.props.onBack || this._onBack,
            toggleFullscreen: this._toggleFullscreen,
            togglePlayPause: this._togglePlayPause,
            toggleControls: this._toggleControls,
            toggleTimer: this._toggleTimer,
        };

        /**
         * Player information
         */
        this.player = {
            controlTimeoutDelay: this.props.controlTimeout || 15000,
            controlTimeout: null,
            ref: Video,
        };

        /**
         * Various animations
         */
        this.animations = {
            bottomControl: {
                marginBottom: new Animated.Value( 0 ),
                opacity: new Animated.Value( 1 ),
            },
            topControl: {
                marginTop: new Animated.Value( 0 ),
                opacity: new Animated.Value( 1 ),
            },
            video: {
                opacity: new Animated.Value( 1 ),
            },
            loader: {
                rotate: new Animated.Value( 0 ),
                MAX_VALUE: 360,
            }
        };

        /**
         * Various styles that be added...
         */
        this.styles = {
            videoStyle: this.props.videoStyle || {},
            containerStyle: this.props.style || {}
        };
    }



    /*------------------------------------------------------
     | Events
     |-------------------------------------------------------
     |
     | These are the events that the <Video> component uses
     | and can be overridden by assigning it as a prop.
     | It is suggested that you override onEnd.
     |
     */

    /**
     * When load starts we display a loading icon
     * and show the controls.
     */
    _onLoadStart = () => {
        this.loadAnimation();
        this.setState({
            loading: true,
        });
    }

    /**
     * When load is finished we hide the load icon
     * and hide the controls. We also set the
     * video duration.
     *
     * @param {object} data The video meta data
     */
    _onLoad = ( data = {} ) => {
        this.setState({
            duration: data.duration,
            loading: false,
        });

        if ( this.state.showControls ) {
            this.setControlTimeout();
        }
    }

    /**
     * For onprogress we fire listeners that
     * update our seekbar and timer.
     *
     * @param {object} data The video meta data
     */
    _onProgress = ( data = {} ) => {
        if ( ! this.state.seeking ) {
            this.setState({
                currentTime: data.currentTime
            });
        }
    }

    /**
     * It is suggested that you override this
     * command so your app knows what to do.
     * Either close the video or go to a
     * new page.
     */
    _onEnd = () => {}

    /**
     * Set the error state to true which then
     * changes our renderError function
     *
     * @param {object} err  Err obj returned from <Video> component
     */
    _onError = ( err ) => {
        this.setState({
            error: true,
            loading: false,
        });
    }

    /**
     * This is a single and double tap listener
     * when the user taps the screen anywhere.
     * One tap toggles controls, two toggles
     * fullscreen mode.
     */
    _onScreenPress = () => {
        let state = this.state;
        const time = new Date().getTime();
        const delta =  time - state.lastScreenPress;

        if ( delta < 300 && this.state.fullscreenToggle === true) {
            this.methods.toggleFullscreen();
        }

        this.methods.toggleControls();

        this.setState({
            lastScreenPress: time
        });
    }


    /*------------------------------------------------------
     | Methods
     |-------------------------------------------------------
     |
     | These are all of our functions that interact with
     | various parts of the class. Anything from
     | calculating time remaining in a video
     | to handling control operations.
     |
     */

    /**
     * Set a timeout when the controls are shown
     * that hides them after a length of time.
     * Default is 15s
     */
    setControlTimeout() {
        this.player.controlTimeout = setTimeout( ()=> {
            this._hideControls();
        }, this.player.controlTimeoutDelay );
    }

    /**
     * Clear the hide controls timeout.
     */
    clearControlTimeout() {
        clearTimeout( this.player.controlTimeout );
    }

    /**
     * Reset the timer completely
     */
    resetControlTimeout() {
        this.clearControlTimeout();
        this.setControlTimeout();
    }

    /**
     * Animation to hide controls. We fade the
     * display to 0 then move them off the
     * screen so they're not interactable
     */
    hideControlAnimation() {
        Animated.parallel([
            Animated.timing(
                this.animations.topControl.opacity,
                { toValue: 0 }
            ),
            Animated.timing(
                this.animations.topControl.marginTop,
                { toValue: -100 }
            ),
            Animated.timing(
                this.animations.bottomControl.opacity,
                { toValue: 0 }
            ),
            Animated.timing(
                this.animations.bottomControl.marginBottom,
                { toValue: -100 }
            ),
        ]).start();
    }

    /**
     * Animation to show controls...opposite of
     * above...move onto the screen and then
     * fade in.
     */
    showControlAnimation() {
        Animated.parallel([
            Animated.timing(
                this.animations.topControl.opacity,
                { toValue: 1 }
            ),
            Animated.timing(
                this.animations.topControl.marginTop,
                { toValue: 0 }
            ),
            Animated.timing(
                this.animations.bottomControl.opacity,
                { toValue: 1 }
            ),
            Animated.timing(
                this.animations.bottomControl.marginBottom,
                { toValue: 0 }
            ),
        ]).start();
    }

    /**
     * Loop animation to spin loader icon. If not loading then stop loop.
     */
    loadAnimation() {
        if ( this.state.loading ) {
            Animated.sequence([
                Animated.timing(
                    this.animations.loader.rotate,
                    {
                        toValue: this.animations.loader.MAX_VALUE,
                        duration: 1500,
                        easing: Easing.linear,
                    }
                ),
                Animated.timing(
                    this.animations.loader.rotate,
                    {
                        toValue: 0,
                        duration: 0,
                        easing: Easing.linear,
                    }
                ),
            ]).start( this.loadAnimation.bind( this ) );
        }
    }

    /**
     * Function to hide the controls. Sets our
     * state then calls the animation.
     */
    _hideControls() {
        this.hideControlAnimation();
        this.setState({
            showControls: false
        });
    }

    /**
     * Function to toggle controls based on
     * current state.
     */
    _toggleControls = () => {
        let state = this.state;
        state.showControls = ! state.showControls;

        if ( state.showControls ) {
            this.showControlAnimation();
            this.setControlTimeout();
        }
        else {
            this.hideControlAnimation();
            this.clearControlTimeout();
        }

        this.setState( state );
    }

    /**
     * Toggle fullscreen changes resizeMode on
     * the <Video> component then updates the
     * isFullscreen state.
     */
    _toggleFullscreen = () => {
        this.setState({
            isFullscreen: !this.state.isFullscreen,
            resizeMode: this.state.isFullscreen === true ? 'cover' : 'contain',
        });
    }

    /**
     * Toggle playing state on <Video> component
     */
    _togglePlayPause = () => {
        this.setState({
            paused: !this.state.paused,
        });
    }

    /**
     * Toggle between showing time remaining or
     * video duration in the timer control
     */
    _toggleTimer = () => {
        this.setState({
            showTimeRemaining: !this.state.showTimeRemaining,
        });
    }

    /**
     * The default 'onBack' function pops the navigator
     * and as such the video player requires a
     * navigator prop by default.
     */
    _onBack = () => {
        if ( this.props.navigator && this.props.navigator.pop ) {
            this.props.navigator.pop();
        }
        else {
            console.warn( 'Warning: _onBack requires navigator property to function. Either modify the onBack prop or pass a navigator prop' );
        }
    }

    /**
     * Calculate the time to show in the timer area
     * based on if they want to see time remaining
     * or duration. Formatted to look as 00:00.
     */
    calculateTime() {
        if ( this.state.showTimeRemaining ) {
            const time = this.state.duration - this.state.currentTime;
            return `-${ this.formatTime( time ) }`;
        }
        return `${ this.formatTime( this.state.currentTime ) }`;
    }

    /**
     * Format a time string as mm:ss
     *
     * @param {int} time time in milliseconds
     * @return {string} formatted time string in mm:ss format
     */
    formatTime( time = 0 ) {
        const symbol = this.state.showRemainingTime ? '-' : '';
        const hours = Math.floor(time / 60 / 60);
        const minutes = Math.floor((time / 60) % 60);
        const seconds = Math.floor(time % 60);
        const formattedHours = _.padStart( hours, 2, 0 );
        const formattedMinutes = _.padStart( minutes, 2, 0 );
        const formattedSeconds = _.padStart( seconds, 2 , 0 );

        if (hours < 1){
            return `${ symbol }${ formattedMinutes }:${ formattedSeconds }`;
        } else {
            return `${ symbol }${ formattedHours }:${ formattedMinutes }:${ formattedSeconds }`;
        }
    }


    onVolumeSliding = (value) => {
        this.setState({
            volume: value,
            muted: value <= 0,
        });
    }

    onVolumeSlidingComplete = (value) => {
        this.setState({
            volume: value,
            muted: value <= 0,
        });
    }

    onSeekSliding = (value) => {
        this.setState({
            currentTime: value,
            seeking: true
        });
        this.player.ref.seek( value );
    }

    onSeekSlidingComplete = (value) => {
        this.setState({
            currentTime: value,
            seeking: false,
        });
        this.player.ref.seek( value );
    }

    /**
     * Seek to a time in the video.
     *
     * @param {float} time time to seek to in ms
     */
    seekTo( time = 0 ) {
        this.player.ref.seek( time );
        this.setState({
            currentTime: time,
        });
    }


    /*------------------------------------------------------
     | React Component functions
     |-------------------------------------------------------
     |
     | Here we're initializing our listeners and getting
     | the component ready using the built-in React
     | Component methods
     |
     */


    /**
     * When the component is about to unmount kill the
     * timeout less it fire in the prev/next scene
     */
    componentWillUnmount() {
        this.clearControlTimeout();
    }

    /*------------------------------------------------------
     | Rendering
     |-------------------------------------------------------
     |
     | This section contains all of our render methods.
     | In addition to the typical React render func
     | we also have all the render methods for
     | the controls.
     |
     */

    /**
     * Standard render control function that handles
     * everything except the sliders. Adds a
     * consistent <TouchableHighlight>
     * wrapper and styling.
     */
    renderControl( children, callback, style = {} ) {
        return (
            <TouchableHighlight
                underlayColor="transparent"
                activeOpacity={ 0.3 }
                onPress={()=>{
                    this.resetControlTimeout();
                    callback();
                }}
                style={[
                    styles.controls.control,
                    style
                ]}
            >
                { children }
            </TouchableHighlight>
        );
    }

    /**
     * Groups the top bar controls together in an animated
     * view and spaces them out.
     */
    renderTopControls() {
        return(
            <Animated.View style={[
                styles.controls.top,
                {
                    opacity: this.animations.topControl.opacity,
                    marginTop: this.animations.topControl.marginTop,
                }
            ]}>
                <View style={[ styles.controls.column, styles.controls.vignette]}>
                    <View style={ styles.controls.topControlGroup }>
                        { this.renderBack() }
                        <View style={ styles.controls.pullRight }>
                            { this.renderVolume() }
                            { this.renderFullscreen() }
                        </View>
                    </View>
                </View>
            </Animated.View>
        );
    }

    /**
     * Back button control
     */
    renderBack() {
        return this.renderControl(
            this.props.backIcon,
            this.methods.onBack,
            styles.controls.back
        );
    }

    /**
     * Render the volume slider and attach the pan handlers
     */
    renderVolume() {

        const {maxTrackColor, minTrackColor, thumbImage, volumeIcon, volumeMutedIcon} = this.props;

        const icon = this.state.volume > 0 ? volumeIcon : volumeMutedIcon;

        return (
            <View style={ styles.volume.container }>
                {icon}
                <Slider
                    style={ styles.volume.slider }
                    trackTintColor={ minTrackColor }
                    thumbTintColor={ minTrackColor }
                    minimumTrackTintColor={ minTrackColor }
                    maximumTrackTintColor={ maxTrackColor }
                    maximumValue={ 1 }
                    thumbImage={ thumbImage }
                    value={ this.state.volume }
                    onValueChange={ this.onVolumeSliding }
                    onSlidingComplete={ this.onVolumeSlidingComplete }
                />
            </View>
        );
    }

    /**
     * Render fullscreen toggle and set icon based on the fullscreen state.
     */
    renderFullscreen() {

        if (this.state.fullscreenToggle === false) return null;
        const icon = this.state.isFullscreen === true ? this.props.shrinkIcon : this.props.expandIcon;
        return this.renderControl(
            icon,
            this.methods.toggleFullscreen,
            styles.controls.fullscreen
        );
    }

    /**
     * Render bottom control group and wrap it in a holder
     */
    renderBottomControls() {
        return(
            <Animated.View style={[
                styles.controls.bottom,
                {
                    opacity: this.animations.bottomControl.opacity,
                    marginBottom: this.animations.bottomControl.marginBottom,
                }
            ]}>
                <View
                    style={[ styles.controls.column, styles.controls.vignette,
                    ]}>
                    <View style={styles.player.container}>
                        { this.renderSeekbar() }
                    </View>
                    <View style={[
                        styles.controls.column,
                        styles.controls.bottomControlGroup
                    ]}>
                        { this.renderPlayPause() }
                        { this.renderTitle() }
                        { this.renderTimer() }
                    </View>
                </View>
            </Animated.View>
        );
    }

    /**
     * Render the seekbar and attach its handlers
     */
    renderSeekbar() {

        const {maxTrackColor, minTrackColor, thumbImage} = this.props;
        return (
            <View style={ styles.seekbar.container}>
                <Slider
                    style={styles.seekbar.slider}
                    trackTintColor={minTrackColor}
                    thumbTintColor={minTrackColor}
                    minimumTrackTintColor={minTrackColor}
                    maximumTrackTintColor={maxTrackColor}
                    maximumValue={this.state.duration}
                    thumbImage={thumbImage}
                    value={this.state.currentTime}
                    onValueChange={this.onSeekSliding}
                    onSlidingComplete={this.onSeekSlidingComplete}
                />
            </View>)
    }

    /**
     * Render the play/pause button and show the respective icon
     */
    renderPlayPause() {
        const icon = this.state.paused === true ? this.props.playIcon : this.props.pauseIcon;
        return this.renderControl(
            icon,
            this.methods.togglePlayPause,
            styles.controls.playPause
        );
    }

    /**
     * Render our title...if supplied.
     */
    renderTitle() {
        if ( this.props.title ) {
            return (
                <View style={[
                    styles.controls.control,
                    styles.controls.title,
                ]}>
                    <Text style={[
                        styles.controls.text,
                        styles.controls.titleText
                    ]} numberOfLines={ 1 }>
                        { this.props.title || '' }
                    </Text>
                </View>
            );
        }

        return null;
    }

    /**
     * Show our timer.
     */
    renderTimer() {
        return this.renderControl(
            <Text style={ styles.controls.timerText }>
                { this.calculateTime() }
            </Text>,
            this.methods.toggleTimer,
            styles.controls.timer
        );
    }

    /**
     * Show loading icon
     */
    renderLoader() {
        if ( this.state.loading ) {
            return (
                <View style={ styles.loader.container }>
                    <Animated.Image source={ require( './assets/img/loader-icon.png' ) } style={[
                        styles.loader.icon,
                        { transform: [
                            { rotate: this.animations.loader.rotate.interpolate({
                                inputRange: [ 0, 360 ],
                                outputRange: [ '0deg', '360deg' ]
                            })}
                        ]}
                    ]} />
                </View>
            );
        }
        return null;
    }

    renderError() {
        if ( this.state.error ) {
            return (
                <View style={ styles.error.container }>
                    <Image source={ require( './assets/img/error-icon.png' ) } style={ styles.error.icon } />
                    <Text style={ styles.error.text }>
                        Video unavailable
                    </Text>
                </View>
            );
        }
        return null;
    }

    /**
     * Provide all of our options and render the whole component.
     */
    render() {
        return (
            <TouchableWithoutFeedback
                onPress={ this.events.onScreenPress }
                style={[ styles.player.container, this.styles.containerStyle ]}
            >
                <View style={[ styles.player.container, this.styles.containerStyle ]}>
                    <Video
                        ref={ videoPlayer => this.player.ref = videoPlayer }

                        resizeMode={ this.state.resizeMode }
                        volume={ this.state.volume }
                        paused={ this.state.paused }
                        muted={ this.state.muted }
                        rate={ this.state.rate }

                        playInBackground={ this.props.playInBackground }
                        playWhenInactive={ this.props.playWhenInactive }
                        repeat={ this.props.repeat }

                        onLoadStart={ this.events.onLoadStart }
                        onProgress={ this.events.onProgress }
                        onError={ this.events.onError }
                        onLoad={ this.events.onLoad }
                        onEnd={ this.events.onEnd }

                        style={[ styles.player.video, this.styles.videoStyle ]}

                        source={ this.props.source }
                    />
                    { this.renderError() }
                    { this.renderTopControls() }
                    { this.renderLoader() }
                    { this.renderBottomControls() }
                </View>
            </TouchableWithoutFeedback>
        );
    }
}

/**
 * This object houses our styles. There's player
 * specific styles and control specific ones.
 * And then there's volume/seeker styles.
 */
const styles = {
    player: StyleSheet.create({
        container: {
            alignSelf: 'stretch',
            justifyContent: 'space-between',
        },
        video: {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
    }),

    seekbar: {
        container: {
            paddingHorizontal: 12,
            marginTop: 12,
        },
        slider: {
        }
    },

    volume: {
        container : {
            width: 150,
            flexDirection: 'row',
            alignItems:'center'
        },
        slider: {
            flex: 1,
            marginLeft: 12,
            marginRight: 12,
        },
    },

    error: StyleSheet.create({
        container: {
            backgroundColor: 'rgba( 0, 0, 0, 0.5 )',
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            justifyContent: 'center',
            alignItems: 'center',
        },
        icon: {
            marginBottom: 16,
        },
        text: {
            backgroundColor: 'transparent',
            color: '#f27474'
        },
    }),
    loader: StyleSheet.create({
        container: {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }),
    controls: StyleSheet.create({
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: null,
            width: null,
        },
        column: {
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: null,
            width: null,
        },
        vignette: {
            backgroundColor: 'rgba(0,0,0,0.6)'
        },
        control: {
            padding: 16,
        },
        text: {
            backgroundColor: 'transparent',
            color: '#FFF',
            fontSize: 16,
            textAlign: 'center',
        },
        pullRight: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        top: {
            flex: 1,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
        },
        bottom: {
            alignItems: 'stretch',
            flex: 2,
            justifyContent: 'flex-end',
        },
        topControlGroup: {
            alignSelf: 'stretch',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexDirection: 'row',
            width: null,
            marginTop: 10,
            marginBottom: 5,
        },
        bottomControlGroup: {
            alignSelf: 'stretch',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexDirection: 'row',
            marginBottom: 0,
        },
        fullscreen: {
            flexDirection: 'row',
        },
        playPause: {
            width: 80,
        },
        title: {
            alignItems: 'center',
            flex: 0.6,
            flexDirection: 'column',
            padding: 0,
        },
        titleText: {
            textAlign: 'center',
        },
        timer: {
            width: 80,
        },
        timerText: {
            backgroundColor: 'transparent',
            color: '#FFF',
            fontSize: 11,
            textAlign: 'right',
        },
    }),
};