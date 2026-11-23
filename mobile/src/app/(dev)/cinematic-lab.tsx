import {Redirect} from 'expo-router';
import CustomerType from '../../components/CustomerType';
import CinematicStage from '../../components/cinematic/CinematicStage';
/** No Home/auth links, no feature flag enabled in main flow; never included as a usable release entry. */
export default function CinematicLab(){if(!__DEV__)return <Redirect href="/customer"/>;return <CustomerType><CinematicStage/></CustomerType>;}
